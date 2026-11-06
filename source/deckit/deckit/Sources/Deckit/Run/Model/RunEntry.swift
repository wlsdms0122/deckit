//
//  RunEntry.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// What deckit keeps of the `number`th run of a mod beside what deck keeps of it.
public struct RunEntry: Sendable {
    // MARK: - Property
    public let number: Int
    // Whether its mod reached the relaunch limit as it failed.
    public internal(set) var relaunchLimited = false
    // What its page reported of it as a person reads it, carried and not read.
    public internal(set) var summary: JSONValue?
    // Once it launched, what it contributes for the layers on deck, by key.
    public internal(set) var contributions: [String: JSONValue]?

    // MARK: - Initializer
    init(number: Int) {
        self.number = number
    }

    // MARK: - Public
    // MARK: - Private
}
