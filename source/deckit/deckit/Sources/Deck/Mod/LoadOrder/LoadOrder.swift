//
//  LoadOrder.swift
//  Deck
//
//  Created by JSilver on 10/22/26.
//

import Foundation

// The load order as it is kept: `loadOrder` in `deck.json`, deck's settings file, a list of mod ids.
final class LoadOrder {
    // MARK: - Property
    private let key = "loadOrder"
    private let settings: DeckSettings

    // MARK: - Initializer
    init(file: URL, store: Store) {
        self.settings = DeckSettings(file: file, store: store)
    }

    // MARK: - Public
    // The ids kept, or none while the file keeps no list of them: it is a person's to edit.
    func read() -> [String] {
        guard case let .array(ids)? = settings.value(of: key) else { return [] }
        return ids.compactMap { id in
            guard case let .string(id) = id else { return nil }
            return id
        }
    }

    func write(_ ids: [String]) throws {
        try settings.write([key: .array(ids.map(JSONValue.string))])
    }

    // MARK: - Private
}
