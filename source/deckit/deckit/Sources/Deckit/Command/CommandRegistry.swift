//
//  CommandRegistry.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The mods whose runs offer what a person may run: commands, readouts of what is happening now, and answers to what
// they type. A run offers each by registering it, which it contributed under its name.
public final class CommandRegistry {
    // MARK: - Property
    private let deck: Deck

    // MARK: - Initializer
    init(deck: Deck) {
        self.deck = deck
    }

    // MARK: - Public
    // In the person's order of the mods.
    public func sources() -> [CommandSource] {
        deck.catalog.loading.compactMap { mod in
            guard let contributions = deck.contributions(of: mod.manifest.id) else { return nil }
            let registered = { (name: String) in contributions.layers[name] == .bool(true) }
            guard registered("commands") || registered("now") || registered("resolve") else { return nil }

            return CommandSource(
                id: mod.manifest.id,
                name: mod.manifest.name,
                commands: registered("commands"),
                now: registered("now"),
                resolve: registered("resolve")
            )
        }
    }

    // MARK: - Private
}
