//
//  URLRouter.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// Which mods an address is offered to, in what order, and what deckit opens it with by itself after them. A mod is
// offered the addresses its manifest's urls patterns match while its run has registered a handler: its run contributes
// `urls`. One whose run has not is passed: a run may register it on one host and not on another. Each scheme has one
// list of handlers. The app names who is asked first, the person orders them and switches them off, and a mod no one
// placed goes before the first whose pattern is wider than its own.
public final class URLRouter {
    // MARK: - Property
    private let contributionKey = "urls"
    private let preferencesKey = "scheme-handlers"
    private let field: URLsField
    private let deck: Deck
    // Scheme -> the mods the app asks first.
    private let schemeHandlers: [String: [String]]
    // Scheme -> how the person arranged its handlers.
    private var preferences: [String: HandlerPreference]

    // MARK: - Initializer
    // `field` is the urls field deck reads manifests with.
    init(deck: Deck, field: URLsField, schemeHandlers: [String: [String]]) {
        self.deck = deck
        self.field = field
        self.schemeHandlers = schemeHandlers
        deck.state.reserve(preferencesKey)
        let saved = try? deck.state.read(folder: nil, key: preferencesKey)
        self.preferences = saved.flatMap { text in
            try? JSONDecoder().decode([String: HandlerPreference].self, from: Data(text.utf8))
        } ?? [:]
    }

    // MARK: - Lifecycle
    // A mod that opens what it names none of is told so as it contributes it.
    func problems(of run: Run, mod: Mod) -> [String] {
        guard handlesURL(run.contributions), mod.manifest.value(of: field).isEmpty else { return [] }
        return ["it registered urls.register(), but manifest.toml names no urls, so nothing asks it"]
    }

    // MARK: - Public
    // A file goes nowhere for a caller that may not hand files on, whoever would answer it: a handler that passes
    // leaves it to the file's app, and the answer tells whether the path exists. `usesDefaultApp` for an address that
    // skips the mods for what deckit opens it with by itself.
    public func route(_ url: String, opensFiles: Bool, usesDefaultApp: Bool) -> URLRoute {
        let address = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let scheme = URLScheme(address: address), scheme.isPlace else {
            return URLRoute(url: address, handlers: [], system: nil)
        }
        let system = SystemHandler(scheme: scheme.name)
        guard opensFiles || system != .file else { return URLRoute(url: address, handlers: [], system: nil) }

        let handlers = usesDefaultApp
            ? []
            : asked(in: handledAs(scheme))
                .filter { asked in asked.on && asked.patterns.contains { pattern in pattern.matches(address) } }
                .map { asked in asked.mod.manifest.id }
        return URLRoute(url: address, handlers: handlers, system: system)
    }

    // Every scheme with a handler list: those deckit opens by itself, then each one a mod handles, then every other.
    public func handlerLists() -> [HandlerList] {
        schemes().map { scheme in
            let handlers = asked(in: scheme).map { mod, patterns, on in
                SchemeHandler(id: mod.manifest.id, name: mod.manifest.name, patterns: patterns.map(\.written), on: on)
            }
            return HandlerList(scheme: scheme, system: SystemHandler(scheme: scheme), handlers: handlers)
        }
    }

    // The handlers in `order` take the places they held among themselves. One missing from the list now, as one that
    // does not load, keeps its place and switch: otherwise editing the list while it was gone would give its place to
    // the app's. Those in `off` are switched off.
    public func setHandlers(of scheme: String, order: [String], off: [String]) throws {
        guard schemes().contains(scheme) else { throw URLRouterError.noHandlers(scheme) }

        let given = Set(order)
        var next = order[...]
        let placed = self.order(of: scheme).compactMap { id in given.contains(id) ? next.popFirst() : id } + next
        let off = preference(of: scheme).off.filter { id in !given.contains(id) } + off
        var preferences = preferences
        preferences[scheme] = HandlerPreference(order: placed, off: off)
        try save(preferences)
    }

    // MARK: - Private
    private func save(_ next: [String: HandlerPreference]) throws {
        let text = String(decoding: try JSONEncoder().encode(next), as: UTF8.self)
        try deck.state.write(reserved: preferencesKey, text: text)
        preferences = next
    }

    private func handlesURL(_ contributions: Contribution?) -> Bool {
        contributions?.layers[contributionKey] == .bool(true)
    }

    // The mods that answer addresses, in the load order, with the patterns each names.
    private func answering() -> [(mod: Mod, patterns: [URLPattern])] {
        deck.catalog.loading.compactMap { mod in
            let patterns = mod.manifest.value(of: field).compactMap(URLPattern.init)
            guard !patterns.isEmpty, handlesURL(deck.contributions(of: mod.manifest.id)) else { return nil }
            return (mod, patterns)
        }
    }

    private func schemes() -> [String] {
        let named = answering().flatMap { _, patterns in patterns.map(\.scheme) }
        let own = named.filter { scheme in scheme != URLScheme.every }
        let every = named.contains(URLScheme.every) ? [URLScheme.every] : []
        var seen: Set<String> = []

        return (SystemHandler.schemes.map(\.scheme) + own + every).filter { scheme in seen.insert(scheme).inserted }
    }

    // The list an address is offered to: its scheme's own, or every scheme's when it has none.
    private func handledAs(_ scheme: URLScheme) -> String {
        schemes().contains(scheme.name) ? scheme.name : URLScheme.every
    }

    // What the app names first and the person has not placed, then what the person placed.
    private func order(of scheme: String) -> [String] {
        let placed = preference(of: scheme).order
        return (schemeHandlers[scheme] ?? []).filter { id in !placed.contains(id) } + placed
    }

    private func preference(of scheme: String) -> HandlerPreference {
        preferences[scheme] ?? HandlerPreference(order: [], off: [])
    }

    // The scheme's handlers in its order, each with its patterns for the scheme and whether it is on. A mod no one
    // placed goes before the first whose pattern is wider than its own, the narrowest first and then by id: the load
    // order says nothing of who opens what.
    private func asked(in scheme: String) -> [(mod: Mod, patterns: [URLPattern], on: Bool)] {
        let order = order(of: scheme)
        let off = preference(of: scheme).off
        let asking = answering().compactMap { mod, patterns in
            let own = patterns.filter { pattern in pattern.match == .every || pattern.scheme == scheme }
            return own.isEmpty ? nil : (mod: mod, patterns: own, specificity: own.map(\.specificity).max()!)
        }
        let placed = order.compactMap { id in asking.first { asks in asks.mod.manifest.id == id } }
        let unplaced = asking
            .filter { asks in !order.contains(asks.mod.manifest.id) }
            .sorted { one, other in
                (-one.specificity, one.mod.manifest.id) < (-other.specificity, other.mod.manifest.id)
            }
        var ordered = placed
        for asks in unplaced {
            let wider = ordered.firstIndex { other in other.specificity < asks.specificity } ?? ordered.endIndex
            ordered.insert(asks, at: wider)
        }

        return ordered.map { mod, patterns, _ in (mod, patterns, !off.contains(mod.manifest.id)) }
    }
}
