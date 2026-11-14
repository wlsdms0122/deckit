//
//  PrincipalStorage.swift
//  Deck
//
//  Created by JSilver on 10/21/26.
//

import Foundation

// What deck keeps of a principal: its data folder, its records and what the layers on deck keep for it.
public final class PrincipalStorage {
    // MARK: - Property
    private let dataFolder: DataFolder
    private let record: Record
    private let principalState: PrincipalState
    private let store: Store

    // MARK: - Initializer
    init(dataFolder: DataFolder, record: Record, principalState: PrincipalState, store: Store) {
        self.dataFolder = dataFolder
        self.record = record
        self.principalState = principalState
        self.store = store
    }

    // MARK: - Public
    // Any id may be asked, so one that is no name is refused.
    public func usage(principal: String) throws -> StorageUsage {
        guard store.isName(principal) else { throw PrincipalStorageError.notAPrincipal(principal) }

        return StorageUsage(
            data: dataFolder.count(principal: principal),
            records: try record.count(principal: principal),
            kept: principalState.kept(principal: principal)
        )
    }

    // Each is erased whether or not another fails, and the first failure is thrown once all were tried.
    func erase(principal: String) throws {
        let failures = [
            Result { try dataFolder.erase(principal: principal) },
            Result { try record.erase(principal: principal) },
            Result { try principalState.erase(principal: principal) }
        ]
        for case let .failure(error) in failures {
            throw error
        }
    }

    // MARK: - Private
}
