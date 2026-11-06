//
//  RunEntry.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// What deckit keeps of the `number`th run of a mod beside what deck keeps of it.
public struct RunEntry: Sendable {
    // MARK: - Property
    public let number: Int
    // Whether its mod reached the relaunch limit as it failed.
    public internal(set) var relaunchLimited = false

    // MARK: - Initializer
    init(number: Int) {
        self.number = number
    }

    // MARK: - Public
    // MARK: - Private
}
