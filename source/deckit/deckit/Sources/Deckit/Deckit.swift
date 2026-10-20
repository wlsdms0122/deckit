//
//  Deckit.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The platform on deck: what it adds, and the deck it is on.
public final class Deckit {
    // MARK: - Property
    public let deck: Deck
    private let keymap: Keymap
    private let commandRegistry: CommandRegistry
    private let urlRouter: URLRouter

    // MARK: - Initializer
    // `name` is the app's, as a person reads it, `schemeHandlers`, by scheme, the mods it asks first to open an
    // address, and `permissions` are those main defines, for what deck, deckit and the shell add; the core adds those
    // it checks itself.
    public init(
        home: URL,
        ship: [URL],
        sources: [URL],
        api: Version,
        name: String,
        schemeHandlers: [String: [String]],
        permissions: [Permission]
    ) throws {
        let urlSchemes = URLSchemesField()
        let deck = try Deck(
            home: home,
            ship: ship,
            sources: sources,
            api: api,
            permissions: permissions + [Keymap.globalKeys],
            fields: [urlSchemes]
        )
        let keymap = Keymap(deck: deck, appName: name)
        let urlRouter = URLRouter(deck: deck, field: urlSchemes, schemeHandlers: schemeHandlers)
        deck.add(keymap)
        deck.add(urlRouter)
        self.deck = deck
        self.keymap = keymap
        self.commandRegistry = CommandRegistry(deck: deck)
        self.urlRouter = urlRouter
    }

    // MARK: - Public
    // A key of the app's own, run by whoever registered it: a global one works anywhere a keystroke is heard, the rest
    // only in the page in front. Answers the keymap as it is resolved now.
    public func registerKey(_ key: Key) -> ResolvedKeymap {
        keymap.register(key)
    }

    // The binding of `id` bound to `spec`, or to none when it is empty. Answers the keymap as it is resolved now.
    public func bindKey(_ id: String, spec: String) throws -> ResolvedKeymap {
        try keymap.bind(id, spec: spec)
    }

    // The binding of `id` back to its default. Answers the keymap as it is resolved now.
    public func resetKey(_ id: String) throws -> ResolvedKeymap {
        try keymap.reset(id)
    }

    // What a keystroke typed to be bound comes to.
    public func recordKey(_ keystroke: Keystroke) -> RecordedKey {
        keymap.record(keystroke)
    }

    // The keystrokes specs name, nil for one that names none.
    public func keystrokes(of specs: [String]) -> [Keystroke?] {
        keymap.keystrokes(of: specs)
    }

    // The mods whose runs offer what a person may run.
    public func commandSources() -> [CommandSource] {
        commandRegistry.sources()
    }

    // Which mods `url` is offered to, in what order, and what deckit opens it with by itself after them.
    public func route(_ url: String, userInitiated: Bool, usesDefaultApp: Bool) -> URLRoute {
        urlRouter.route(url, userInitiated: userInitiated, usesDefaultApp: usesDefaultApp)
    }

    public func handlerLists() -> [HandlerList] {
        urlRouter.handlerLists()
    }

    // The handlers of `scheme` in `order` take the places they held among themselves; those in `off` are switched off.
    public func setHandlers(of scheme: String, order: [String], off: [String]) throws {
        try urlRouter.setHandlers(of: scheme, order: order, off: off)
    }

    // MARK: - Private
}
