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
    public let keymap: Keymap
    public let commands: CommandRegistry
    public let urlRouter: URLRouter

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
        deck.add(Layer(problems: keymap.problems, changes: keymap.changes))
        deck.add(Layer(problems: urlRouter.problems))
        self.deck = deck
        self.keymap = keymap
        self.commands = CommandRegistry(deck: deck)
        self.urlRouter = urlRouter
    }

    // MARK: - Public
    // MARK: - Private
}
