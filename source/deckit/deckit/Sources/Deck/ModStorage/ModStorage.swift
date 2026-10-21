//
//  ModStorage.swift
//  Deck
//
//  Created by JSilver on 10/21/26.
//

import Foundation

// What deck keeps of a mod: its data folder, its records and its settings.
public final class ModStorage {
    // MARK: - Property
    private let dataFolder: DataFolder
    private let record: Record
    private let setting: Setting
    private let store: Store

    // MARK: - Initializer
    init(dataFolder: DataFolder, record: Record, setting: Setting, store: Store) {
        self.dataFolder = dataFolder
        self.record = record
        self.setting = setting
        self.store = store
    }

    // MARK: - Public
    // A mod that manages the mods asks for any id, so one that is no mod's is refused.
    public func usage(mod: String) throws -> StorageUsage {
        guard store.isName(mod) else { throw ModStorageError.notAMod(mod) }

        return StorageUsage(
            data: dataFolder.count(mod: mod),
            records: try record.count(mod: mod),
            settings: setting.isKept(mod: mod)
        )
    }

    // Each is erased whether or not another fails, and the first failure is thrown once all were tried.
    func erase(mod: String) throws {
        let failures = [
            Result { try dataFolder.erase(mod: mod) },
            Result { try record.erase(mod: mod) },
            Result { try setting.erase(mod: mod) }
        ]
        for case let .failure(error) in failures {
            throw error
        }
    }

    // MARK: - Private
}
