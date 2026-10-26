//
//  Keymap.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The keys of the hosts and of the mods that run, bound to chords a person may change, and how a keystroke is resolved
// against them. Each key runs where its provider is. A mod's keys are those its run contributed under `keys`, taken
// while it runs and as it terminates; a host's are registered under a name of its own.
public final class Keymap {
    // MARK: - Property
    // What a mod holds for keys that work past its own page, by their scope.
    static let appKeysPermission = Permission(
        id: "deckit.app-keys",
        name: "App Keys",
        means: "Its keys work wherever you are in the app, whatever is in front, and are taken from every page there."
    )
    static let globalKeysPermission = Permission(
        id: "system.global-keys",
        name: "Global Keys",
        means: "Its keys work in every app, this one in front or not, and are taken from all of them."
    )

    private let contributionKey = "keys"
    private let overridesKey = "keys"
    private let deck: Deck
    private let hostName: String
    // In the order they were registered.
    private var hostKeys: [(provider: Provider, key: Key)] = []
    // In the order they were made.
    private var overrides: [BindingOverride]
    private var told = ResolvedKeymap(revision: 0, bindings: [])

    // MARK: - Initializer
    // `hostName` is the app's, as a person reads it.
    init(deck: Deck, hostName: String) {
        self.deck = deck
        self.hostName = hostName
        deck.state.reserve(overridesKey)
        let saved = try? deck.state.read(folder: nil, key: overridesKey)
        self.overrides = saved.flatMap { text in try? JSONDecoder().decode([BindingOverride].self, from: Data(text.utf8)) }
            ?? []
    }

    // MARK: - Lifecycle
    func problems(of run: Run, mod: Mod) -> [String] {
        declared(in: run.contributions).compactMap { key in problem(of: key, mod: mod) }
    }

    // The keymap, once it resolves otherwise than the driver was last told.
    func changes() -> [any LayerChange] {
        let now = resolved()
        guard now != told.bindings else { return [] }

        return [tell(now)]
    }

    // MARK: - Public
    // The hosts that registered keys.
    var hosts: [Provider] {
        hostKeys.map(\.provider)
    }

    // A key of a host's, `provider` its name, which starts with "@", working in its scope, in place of one it registered
    // by that name. Answers the keymap as it is resolved now.
    public func register(_ key: Key, provider: String) throws -> ResolvedKeymap {
        guard let host = Provider(host: provider, name: hostName) else { throw KeymapError.notAHost(provider) }
        if key.label.isEmpty { throw KeymapError.noLabel(key.name) }
        hostKeys.removeAll { registered in registered.provider == host && registered.key.name == key.name }
        hostKeys.append((host, key))
        return tell(resolved())
    }

    // The binding of `id` bound to `spec`, or to none when it is empty. Answers the keymap as it is resolved now.
    public func bind(_ id: String, spec: String) throws -> ResolvedKeymap {
        guard let binding = ordered().first(where: { binding in binding.id == id }) else {
            throw KeymapError.noSuchBinding(id)
        }
        let wanted = spec.isEmpty ? nil : Keystroke(spec: spec)
        if !spec.isEmpty && wanted == nil { throw KeymapError.notAChord(spec) }
        if let wanted, !wanted.fits(binding.scope) {
            throw KeymapError.cannotWork(label: wanted.label, scope: binding.scope)
        }

        // Taken out and put back last, so the overrides keep the order changes were made in.
        var next = overrides.filter { override in override.id != id }
        if wanted != binding.defaultKeystroke {
            next.append(BindingOverride(id: id, spec: wanted?.spec ?? ""))
        }
        try save(next)

        return tell(resolved())
    }

    // The binding of `id` back to its default. Answers the keymap as it is resolved now.
    public func reset(_ id: String) throws -> ResolvedKeymap {
        if overrides.contains(where: { override in override.id == id }) {
            try save(overrides.filter { override in override.id != id })
        }

        return tell(resolved())
    }

    // MARK: - Private
    private func save(_ next: [BindingOverride]) throws {
        let text = String(decoding: try JSONEncoder().encode(next), as: UTF8.self)
        try deck.state.write(reserved: overridesKey, text: text)
        overrides = next
    }

    private func tell(_ bindings: [ResolvedBinding]) -> ResolvedKeymap {
        told = ResolvedKeymap(revision: told.revision + 1, bindings: bindings)
        return told
    }

    private func declared(in contributions: Contribution?) -> [Key] {
        guard let written = contributions?.layers[contributionKey] else { return [] }
        return (try? written.decode(as: [Key].self)) ?? []
    }

    // What keeps a mod's key from being taken, or nil.
    private func problem(of key: Key, mod: Mod) -> String? {
        guard let keystroke = Keystroke(spec: key.spec) else {
            let missing = key.spec.isEmpty ? "it needs a chord in \"key\"" : "\"\(key.spec)\" is not a chord"
            return "key \"\(key.name)\" cannot be used: \(missing)"
        }
        if key.label.isEmpty { return KeymapError.noLabel(key.name).message }
        guard let permission = Self.permission(for: key.scope) else { return nil }
        let cannot = "key \"\(key.name)\" cannot work \(key.scope.phrase)"
        guard mod.manifest.permissions.contains(where: { request in request.permission.id == permission.id }) else {
            return "\(cannot): that takes the \(permission.id) permission"
        }
        guard keystroke.fits(key.scope) else { return "\(cannot): \(Keystroke.wideRule)" }

        return nil
    }

    private static func permission(for scope: KeyScope) -> Permission? {
        switch scope {
        case .local:
            nil

        case .app:
            appKeysPermission

        case .global:
            globalKeysPermission
        }
    }

    private func binding(of key: Key, provider: Provider) -> Binding {
        let declared = Keystroke(spec: key.spec)
        let id = provider.id(of: key.name)
        let override = overrides.first { override in override.id == id }
        let keystroke = override.map { override in Keystroke(spec: override.spec) } ?? declared

        return Binding(
            provider: provider,
            scope: key.scope,
            name: key.name,
            label: key.label,
            defaultKeystroke: declared,
            keystroke: keystroke,
            changed: override != nil && keystroke != declared
        )
    }

    // In the order a keystroke tries them, the narrowest scope first: a mod's keys in its own page, the hosts' in any
    // page in front, then anywhere in the app, then in every app, the hosts' before the mods' in the load order. A
    // mod's key works past its page only with the permission for its scope.
    private func ordered() -> [Binding] {
        let mods = deck.catalog.loading.map { mod in
            (
                provider: Provider.mod(id: mod.manifest.id, name: mod.manifest.name),
                keys: declared(in: deck.contributions(of: mod.manifest.id)).filter { key in
                    problem(of: key, mod: mod) == nil
                }
            )
        }
        let app = { (scope: KeyScope) in
            self.hostKeys
                .filter { _, key in key.scope == scope }
                .map { provider, key in self.binding(of: key, provider: provider) }
        }
        let own = { (scope: KeyScope) in
            mods.flatMap { provider, keys in
                keys.filter { key in key.scope == scope }.map { key in self.binding(of: key, provider: provider) }
            }
        }

        return own(.local) + app(.local) + app(.app) + own(.app) + app(.global) + own(.global)
    }

    // Defaults first, then changes in the order they were made, so a change landing on a chord already taken in its
    // scope is the one held back. Among defaults nothing is held back: of those that contend for a chord the first
    // listed runs.
    private func resolved() -> [ResolvedBinding] {
        let list = ordered()
        let order = overrides.map(\.id)
        let rank = { (index: Int) in list[index].changed ? order.firstIndex(of: list[index].id) ?? -1 : -1 }
        var issues = Array(repeating: [BindingIssue](), count: list.count)
        var held: Set<Int> = []
        var accepted: [Int] = []
        for index in list.indices.sorted(by: { left, right in (rank(left), left) < (rank(right), right) }) {
            guard let keystroke = list[index].keystroke else { continue }
            let taken = accepted.first { other in
                list[other].keystroke == keystroke && list[other].contends(with: list[index])
            }
            if let taken, list[index].changed {
                held.insert(index)
                issues[index].append(BindingIssue(kind: .held, other: list[taken]))
                continue
            }
            accepted.append(index)
        }
        for index in accepted {
            let first = accepted.first { other in
                other < index && list[other].keystroke == list[index].keystroke
                    && list[other].contends(with: list[index])
            }
            if let first {
                issues[index].append(BindingIssue(kind: .shadowed, other: list[first]))
            }
        }

        return list.indices.map { index in
            ResolvedBinding(
                binding: list[index],
                active: list[index].keystroke != nil && !held.contains(index),
                issues: issues[index]
            )
        }
    }
}
