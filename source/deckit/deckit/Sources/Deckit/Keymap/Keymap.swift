//
//  Keymap.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The keys of the app and of the mods that run, bound to chords a person may change, and how a keystroke is resolved
// against them. A mod's keys are those its run contributed under `keys`, taken while it runs and as it terminates; the
// app's are registered by the host app and the shell it puts on deckit.
public final class Keymap {
    // MARK: - Property
    // What a mod holds for keys that work past its own page, by their reach.
    static let appKeysPermission = Permission(
        id: "deckit.app-keys",
        name: "Keys Anywhere in the App",
        means: "Its keys work wherever you are in the app, whatever is in front, and are taken from every page there.",
        reach: .app
    )
    static let globalKeysPermission = Permission(
        id: "system.global-keys",
        name: "Global Keys",
        means: "Its keys work in every app, this one in front or not, and are taken from all of them.",
        reach: .system
    )

    private let contributionKey = "keys"
    private let overridesKey = "keys"
    private let deck: Deck
    private let app: BindingOwner
    private var appKeys: [Key] = []
    // In the order they were made.
    private var overrides: [BindingOverride]
    private var told = ResolvedKeymap(revision: 0, bindings: [])

    // MARK: - Initializer
    // `appName` is the app's, as a person reads it.
    init(deck: Deck, appName: String) {
        self.deck = deck
        self.app = .app(name: appName)
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
    // A key of the app's own, run by whoever registered it, working as far as its reach. Answers the keymap as it is
    // resolved now.
    public func register(_ key: Key) -> ResolvedKeymap {
        appKeys.append(key)
        return tell(resolved())
    }

    // The binding of `id` bound to `spec`, or to none when it is empty. Answers the keymap as it is resolved now.
    public func bind(_ id: String, spec: String) throws -> ResolvedKeymap {
        guard let binding = ordered().first(where: { binding in binding.id == id }) else {
            throw KeymapError.noSuchBinding(id)
        }
        let wanted = spec.isEmpty ? nil : Keystroke(spec: spec)
        if !spec.isEmpty && wanted == nil { throw KeymapError.notAChord(spec) }
        if let wanted, !wanted.fits(binding.reach) {
            throw KeymapError.cannotReach(label: wanted.label, reach: binding.reach)
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
            return "key \"\(key.action)\" cannot be used: \(missing)"
        }
        guard let permission = Self.permission(for: key.reach) else { return nil }
        let cannot = "key \"\(key.action)\" cannot work \(key.reach.phrase)"
        guard mod.manifest.permissions.contains(where: { request in request.permission.id == permission.id }) else {
            return "\(cannot): that takes the \(permission.id) permission"
        }
        guard keystroke.fits(key.reach) else { return "\(cannot): \(Keystroke.wideRule)" }

        return nil
    }

    private static func permission(for reach: KeyReach) -> Permission? {
        switch reach {
        case .front:
            nil

        case .app:
            appKeysPermission

        case .system:
            globalKeysPermission
        }
    }

    private func binding(of key: Key, owner: BindingOwner) -> Binding {
        let declared = Keystroke(spec: key.spec)
        let id = owner.bindingId(of: key.action)
        let override = overrides.first { override in override.id == id }
        let keystroke = override.map { override in Keystroke(spec: override.spec) } ?? declared

        return Binding(
            owner: owner,
            reach: key.reach,
            action: key.action,
            label: key.label.isEmpty ? key.action : key.label,
            defaultKeystroke: declared,
            keystroke: keystroke,
            changed: override != nil && keystroke != declared
        )
    }

    // In the order a keystroke tries them: those that work past their page first, the app's then the mods' in the load
    // order, then a mod's own, which wins in its page a chord it shares with the app's, then the app's. A mod's key
    // works past its page only with the permission for its reach.
    private func ordered() -> [Binding] {
        let mods = deck.catalog.loading.map { mod in
            (
                owner: BindingOwner.mod(id: mod.manifest.id, name: mod.manifest.name),
                keys: declared(in: deck.contributions(of: mod.manifest.id))
                    .filter { key in problem(of: key, mod: mod) == nil }
            )
        }
        let app = { (wide: Bool) in
            self.appKeys
                .filter { key in key.reach.isWide == wide }
                .map { key in self.binding(of: key, owner: self.app) }
        }
        let own = { (wide: Bool) in
            mods.flatMap { owner, keys in
                keys
                    .filter { key in key.reach.isWide == wide }
                    .map { key in self.binding(of: key, owner: owner) }
            }
        }

        return app(true) + own(true) + own(false) + app(false)
    }

    // Defaults first, then changes in the order they were made, so a change landing on a chord already taken is the one
    // held back. Among defaults nothing is held back.
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
                list[other].keystroke == keystroke && list[other].meets(list[index])
            }
            if let taken, list[index].changed {
                held.insert(index)
                issues[index].append(BindingIssue(kind: .held, other: list[taken]))
                continue
            }
            accepted.append(index)
        }
        for index in accepted {
            for other in accepted where other != index {
                if let kind = issue(of: list[index], against: list[other], earlier: other < index) {
                    issues[index].append(BindingIssue(kind: kind, other: list[other]))
                }
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

    // How a keystroke on the chord both are bound to is resolved for `binding` against `other`, listed `earlier` or
    // not, or nil when neither gets in the other's way.
    private func issue(of binding: Binding, against other: Binding, earlier: Bool) -> BindingIssue.Kind? {
        guard other.keystroke == binding.keystroke, other.meets(binding) else { return nil }
        let wide = binding.reach.isWide
        let otherWide = other.reach.isWide
        if otherWide && !wide { return .shadowed }
        if wide && otherWide && earlier { return .shadowed }
        if !wide && !otherWide && other.owner == binding.owner && earlier { return .shadowed }
        if binding.isOwnPage && !otherWide && other.owner.isApp { return .hides }
        if !wide && binding.owner.isApp && other.isOwnPage { return .hidden }

        return nil
    }
}
