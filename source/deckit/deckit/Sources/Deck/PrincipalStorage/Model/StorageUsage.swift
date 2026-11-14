//
//  StorageUsage.swift
//  Deck
//
//  Created by JSilver on 10/21/26.
//

import Foundation

// What a principal has in each place deck keeps it: the files of its data folder, the files of its records, the names
// the layers on deck keep anything of it under, and how many keys are authorized for it.
public struct StorageUsage: Equatable, Sendable {
    // MARK: - Property
    public let data: DataCount
    public let records: RecordCount
    public let kept: [String]
    public let keys: Int

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
