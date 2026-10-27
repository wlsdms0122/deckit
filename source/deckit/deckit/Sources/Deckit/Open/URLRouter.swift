//
//  URLRouter.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// Which mods an address is offered to, in what order, and what deckit opens it with by itself after them. A mod handles
// the schemes its manifest names under url-schemes while its run has registered deckit.handleURL(): its run contributes
// `handleURL`. One whose run has not is passed: a run may register it on one host and not on another. The app names
// who is asked first for each scheme, and the person orders them and switches them off.
public final class URLRouter {
    // MARK: - Property
    private let contributionKey = "handleURL"
    private let preferencesKey = "scheme-handlers"
    private let field: URLSchemesField
    private let deck: Deck
    // Scheme -> the mods the app asks first.
    private let schemeHandlers: [String: [String]]
    // Scheme -> how the person arranged its handlers.
    private var preferences: [String: HandlerPreference]

    // MARK: - Initializer
    // `field` is the url-schemes field deck reads manifests with.
    init(deck: Deck, field: URLSchemesField, schemeHandlers: [String: [String]]) {
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
        return ["it registered deckit.handleURL(), but manifest.toml names no url-schemes, so nothing asks it"]
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

        let handlers = usesDefaultApp ? [] : handlers(of: handledAs(scheme)).filter(\.on).map(\.id)
        return URLRoute(url: address, handlers: handlers, system: system)
    }

    // Every scheme with a handler list: those deckit opens by itself, then each one a mod handles, then every other.
    public func handlerLists() -> [HandlerList] {
        schemes().map { scheme in
            HandlerList(scheme: scheme, system: SystemHandler(scheme: scheme), handlers: handlers(of: scheme))
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

    // The mods that answer addresses, in the load order, with the schemes each names.
    private func answering() -> [(mod: Mod, schemes: [String])] {
        deck.catalog.loading.compactMap { mod in
            let schemes = mod.manifest.value(of: field)
            guard !schemes.isEmpty, handlesURL(deck.contributions(of: mod.manifest.id)) else { return nil }
            return (mod, schemes)
        }
    }

    private func schemes() -> [String] {
        let named = answering().flatMap(\.schemes)
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

    // In the scheme's order; a mod no one placed comes after, by its id: the load order says nothing of who opens
    // what.
    private func handlers(of scheme: String) -> [SchemeHandler] {
        let order = order(of: scheme)
        let off = preference(of: scheme).off
        let rank = { (id: String) in order.firstIndex(of: id) ?? order.count }

        return answering()
            .filter { _, schemes in schemes.contains { named in named == URLScheme.every || named == scheme } }
            .map { mod, _ in
                SchemeHandler(id: mod.manifest.id, name: mod.manifest.name, on: !off.contains(mod.manifest.id))
            }
            .sorted { one, other in (rank(one.id), one.id) < (rank(other.id), other.id) }
    }
}
