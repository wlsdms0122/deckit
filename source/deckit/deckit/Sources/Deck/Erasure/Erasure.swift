//
//  Erasure.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What deck keeps of a mod removed with its data is erased: what its storage holds here, and by the driver what the
// driver keeps of it outside the core (its pages' storage among it). The mod is noted as uncleared before any of it is
// erased, and until the driver says it cleared its part, so whatever was not erased is erased again: in `deck.json`,
// under `uncleared`, their ids.
public final class Erasure {
    // MARK: - Property
    private let key = "uncleared"
    private let storage: ModStorage
    private let settings: DeckSettings
    private let store: Store

    // MARK: - Initializer
    init(storage: ModStorage, settings: DeckSettings, store: Store) {
        self.storage = storage
        self.settings = settings
        self.store = store
    }

    // MARK: - Public
    // An id outside the mod id rule is refused: it names files here.
    public func erase(mod: String) throws {
        guard store.isName(mod) else { throw ErasureError.notAMod(mod) }

        let noted = uncleared()
        if !noted.contains(mod) {
            try note(noted + [mod])
        }
        try storage.erase(mod: mod)
    }

    // The mods erased whose part kept outside the core the driver has not cleared yet.
    public func uncleared() -> [String] {
        guard case let .array(ids)? = settings.value(of: key) else { return [] }
        return ids.compactMap { id in
            guard case let .string(id) = id else { return nil }
            return id
        }
    }

    public func cleared(mod: String) throws {
        try note(uncleared().filter { id in id != mod })
    }

    // MARK: - Private
    private func note(_ ids: [String]) throws {
        try settings.write([key: .array(ids.map(JSONValue.string))])
    }
}
