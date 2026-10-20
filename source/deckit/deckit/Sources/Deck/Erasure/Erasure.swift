//
//  Erasure.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What deck keeps of a mod removed with its data is erased: its data folder, its records and its settings here, and
// what its pages stored and its web sessions by main. The mod is noted as uncleared before any of it is erased, and
// until main says it cleared its part, so whatever was not erased is erased again.
final class Erasure {
    // MARK: - Property
    private let key = "uncleared"
    private let dataFolder: DataFolder
    private let record: Record
    private let setting: Setting
    private let state: State
    private let store: Store

    // MARK: - Initializer
    init(dataFolder: DataFolder, record: Record, setting: Setting, state: State, store: Store) {
        self.dataFolder = dataFolder
        self.record = record
        self.setting = setting
        self.state = state
        self.store = store
    }

    // MARK: - Public
    // An id outside the mod id rule is refused: it names files here. Each is erased whether or not another fails, and
    // the first failure is thrown once all were tried.
    func erase(mod: String) throws {
        guard store.isName(mod) else { throw ErasureError.notAMod(mod) }

        let noted = uncleared()
        if !noted.contains(mod) {
            try note(noted + [mod])
        }
        let failures = [
            Result { try dataFolder.erase(mod: mod) },
            Result { try record.erase(mod: mod) },
            Result { try setting.erase(mod: mod) }
        ]
        for case let .failure(error) in failures {
            throw error
        }
    }

    // The mods erased whose pages' storage and web sessions main has not cleared yet.
    func uncleared() -> [String] {
        guard let text = try? state.read(folder: nil, key: key) else { return [] }
        return (try? JSONDecoder().decode([String].self, from: Data(text.utf8))) ?? []
    }

    func cleared(mod: String) throws {
        try note(uncleared().filter { id in id != mod })
    }

    // MARK: - Private
    private func note(_ ids: [String]) throws {
        try state.write(folder: nil, key: key, text: String(decoding: try JSONEncoder().encode(ids), as: UTF8.self))
    }
}
