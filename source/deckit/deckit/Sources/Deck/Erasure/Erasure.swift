//
//  Erasure.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What deck keeps of a mod removed with its data is erased: what its storage holds here, and what its pages stored and
// its web sessions by the driver. The mod is noted as uncleared before any of it is erased,
// and until the driver says it cleared its part, so whatever was not erased is erased again.
public final class Erasure {
    // MARK: - Property
    private let key = "uncleared"
    private let storage: ModStorage
    private let state: State
    private let store: Store

    // MARK: - Initializer
    init(storage: ModStorage, state: State, store: Store) {
        self.storage = storage
        self.state = state
        self.store = store
        state.reserve(key)
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

    // The mods erased whose pages' storage and web sessions the driver has not cleared yet.
    public func uncleared() -> [String] {
        guard let text = try? state.read(folder: nil, key: key) else { return [] }
        return (try? JSONDecoder().decode([String].self, from: Data(text.utf8))) ?? []
    }

    public func cleared(mod: String) throws {
        try note(uncleared().filter { id in id != mod })
    }

    // MARK: - Private
    private func note(_ ids: [String]) throws {
        try state.write(reserved: key, text: String(decoding: try JSONEncoder().encode(ids), as: UTF8.self))
    }
}
