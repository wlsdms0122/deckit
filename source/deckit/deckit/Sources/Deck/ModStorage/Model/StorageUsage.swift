//
//  StorageUsage.swift
//  Deck
//
//  Created by JSilver on 10/21/26.
//

import Foundation

// What a mod has in each place deck keeps it: the files of its data folder, the files of its records, and the names the
// layers on deck keep anything of it under.
public struct StorageUsage: Equatable, Sendable {
    // MARK: - Property
    public let data: DataCount
    public let records: RecordCount
    public let kept: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
