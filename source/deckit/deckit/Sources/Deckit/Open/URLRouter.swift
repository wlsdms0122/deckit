//
//  URLRouter.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// Which mods an address is offered to, in what order, and what deckit opens it with by itself after them. Each scheme
// has one list of handlers: the mods whose manifest names a pattern of it or `*`, but for those that do not load by
// their own manifest. An address is offered to each handler of its list that is on, loads and has a pattern that
// matches it, unless its run has started without registering a handler: a run that registered one contributes `urls`,
// and a mod not running is launched as the address is offered to it. The person's order comes first, then the app's,
// and a mod no one placed goes before the first handler wider than its own at the address.
public final class URLRouter {
    // MARK: - Property
    private let contributionKey = "urls"
    private let preferencesKey = "scheme-handlers"
    private let field: URLsField
    private let deck: Deck
    // Scheme -> the mods the app places in its list.
    private let schemeHandlers: [String: [String]]
    // Scheme -> how the person arranged its handlers.
    private var preferences: [String: ListPreference]

    // MARK: - Initializer
    // `field` is the urls field deck reads manifests with.
    init(deck: Deck, field: URLsField, schemeHandlers: [String: [String]]) {
        self.deck = deck
        self.field = field
        self.schemeHandlers = schemeHandlers
        deck.state.reserve(preferencesKey)
        let saved = try? deck.state.read(folder: nil, key: preferencesKey)
        self.preferences = saved.flatMap { text in
            try? JSONDecoder().decode([String: ListPreference].self, from: Data(text.utf8))
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

        let loading = Set(deck.catalog.loading.map(\.manifest.id))
        let handlers = usesDefaultApp
            ? []
            : ordered(in: handledAs(scheme)) { patterns in
                patterns.filter { pattern in pattern.matches(address) }.map(\.specificity).max()
            }
            .filter { handler in
                let id = handler.mod.manifest.id
                return handler.on && loading.contains(id) && (deck.contributions(of: id).map(handlesURL) ?? true)
            }
            .map { handler in handler.mod.manifest.id }
        return URLRoute(url: address, handlers: handlers, system: system)
    }

    // Every scheme with a handler list: those deckit opens by itself, then each one a mod handles, then every other.
    // Each comes in the order an address only its widest patterns match is offered: each handler measured at its
    // widest pattern for the scheme.
    public func handlerLists() -> [HandlerList] {
        schemes().map { scheme in
            let handlers = ordered(in: scheme) { patterns in patterns.map(\.specificity).min() }
            return HandlerList(
                scheme: scheme,
                system: SystemHandler(scheme: scheme),
                undecided: undecided(in: scheme),
                handlers: handlers.map { mod, patterns, on, _ in
                    SchemeHandler(
                        id: mod.manifest.id,
                        name: mod.manifest.name,
                        patterns: patterns.map(\.written),
                        on: on
                    )
                }
            )
        }
    }

    // The handlers in `order` take the places they held among themselves, and those placed that it does not name come
    // after them. One missing from the list now, as one that does not load, keeps its place and switch: otherwise
    // editing the list while it was gone would give its place to the app's. Those in `off` are switched off.
    public func setHandlers(of scheme: String, order: [String], off: [String]) throws {
        guard schemes().contains(scheme) else { throw URLRouterError.noHandlers(scheme) }

        var preferences = preferences
        preferences[scheme] = preference(of: scheme).arranged(
            order: order,
            off: off,
            host: schemeHandlers[scheme] ?? [],
            listed: members(of: scheme).map { mod, _ in mod.manifest.id }
        )
        try save(preferences)
    }

    // MARK: - Private
    private func save(_ next: [String: ListPreference]) throws {
        let text = String(decoding: try JSONEncoder().encode(next), as: UTF8.self)
        try deck.state.write(reserved: preferencesKey, text: text)
        preferences = next
    }

    private func handlesURL(_ contributions: Contribution?) -> Bool {
        contributions?.layers[contributionKey] == .bool(true)
    }

    // The mods in the scheme's list, each with its patterns for the scheme: those of the scheme and `*`.
    private func members(of scheme: String) -> [(mod: Mod, patterns: [URLPattern])] {
        deck.catalog.listed.compactMap { mod in
            let own = mod.manifest.value(of: field).filter { pattern in
                pattern.match == .every || pattern.scheme == scheme
            }
            return own.isEmpty ? nil : (mod, own)
        }
    }

    private func schemes() -> [String] {
        let named = deck.catalog.listed.flatMap { mod in mod.manifest.value(of: field).map(\.scheme) }
        let own = named.filter { scheme in scheme != URLScheme.every }
        let every = named.contains(URLScheme.every) ? [URLScheme.every] : []
        var seen: Set<String> = []

        return (SystemHandler.schemes.map(\.scheme) + own + every).filter { scheme in seen.insert(scheme).inserted }
    }

    // The list an address is offered to: its scheme's own, or every scheme's when it has none.
    private func handledAs(_ scheme: URLScheme) -> String {
        schemes().contains(scheme.name) ? scheme.name : URLScheme.every
    }

    private func preference(of scheme: String) -> ListPreference {
        preferences[scheme] ?? .none
    }

    // The handlers of the scheme's list that `width` measures, in the order an address where they are measured is
    // offered to them, each with whether it is on and its width there. `width` answers the specificity of a handler's
    // patterns for the scheme there, or nil where it has none. The person's and the app's placed come first, in their
    // order, and each no one placed goes before the first wider than its own, the narrowest first and then by id: the
    // mods' order says nothing of who opens what.
    private func ordered(
        in scheme: String,
        width: ([URLPattern]) -> Int?
    ) -> [(mod: Mod, patterns: [URLPattern], on: Bool, width: Int)] {
        let preference = preference(of: scheme)
        let order = preference.placed(host: schemeHandlers[scheme] ?? [])
        let measured = members(of: scheme).compactMap { mod, patterns in
            width(patterns).map { width in
                (mod: mod, patterns: patterns, on: !preference.off.contains(mod.manifest.id), width: width)
            }
        }
        let placed = order.compactMap { id in measured.first { handler in handler.mod.manifest.id == id } }
        let unplaced = measured
            .filter { handler in !order.contains(handler.mod.manifest.id) }
            .sorted { one, other in (-one.width, one.mod.manifest.id) < (-other.width, other.mod.manifest.id) }
        var ordered = placed
        for handler in unplaced {
            let wider = ordered.firstIndex { other in other.width < handler.width } ?? ordered.endIndex
            ordered.insert(handler, at: wider)
        }

        return ordered
    }

    // The patterns of the scheme's list whose addresses go to mods no one placed by id alone: at the addresses of
    // each, the first two handlers that are on were placed by no one and wrote it. `*` stands for the addresses of the
    // scheme in its list.
    private func undecided(in scheme: String) -> [String] {
        let placed = preference(of: scheme).placed(host: schemeHandlers[scheme] ?? [])
        var written: [URLPattern] = []
        for pattern in members(of: scheme).flatMap(\.patterns) where !written.map(\.match).contains(pattern.match) {
            written.append(pattern)
        }

        return written
            .filter { pattern in
                let first = ordered(in: scheme) { patterns in
                    patterns.filter { own in own.covers(pattern, in: scheme) }.map(\.specificity).max()
                }
                .filter(\.on)
                .prefix(2)
                return first.count == 2 && first.allSatisfy { handler in
                    !placed.contains(handler.mod.manifest.id) && handler.width == pattern.specificity
                }
            }
            .map(\.written)
    }
}
