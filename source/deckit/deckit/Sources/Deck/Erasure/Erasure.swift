//
//  Erasure.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What deck keeps of a principal removed with its data is erased: what its storage holds here, and by the driver what
// the driver keeps of it outside the core (its pages' storage among it). The principal is noted as uncleared before any
// of it is erased, and until the driver says it cleared its part, so whatever was not erased is erased again: in
// `deck.json`, under `uncleared`, their ids.
public final class Erasure {
    // MARK: - Property
    private let key = "uncleared"
    private let storage: PrincipalStorage
    private let settings: DeckSettings
    private let store: Store

    // MARK: - Initializer
    init(storage: PrincipalStorage, settings: DeckSettings, store: Store) {
        self.storage = storage
        self.settings = settings
        self.store = store
    }

    // MARK: - Public
    // An id that is no name is refused: it names files here.
    public func erase(principal: String) throws {
        guard store.isName(principal) else { throw ErasureError.notAPrincipal(principal) }

        let noted = uncleared()
        if !noted.contains(principal) {
            try note(noted + [principal])
        }
        try storage.erase(principal: principal)
    }

    // The principals erased whose part kept outside the core the driver has not cleared yet.
    public func uncleared() -> [String] {
        guard case let .array(ids)? = settings.value(of: key) else { return [] }
        return ids.compactMap { id in
            guard case let .string(id) = id else { return nil }
            return id
        }
    }

    public func cleared(principal: String) throws {
        try note(uncleared().filter { id in id != principal })
    }

    // MARK: - Private
    private func note(_ ids: [String]) throws {
        try settings.write([key: .array(ids.map(JSONValue.string))])
    }
}
