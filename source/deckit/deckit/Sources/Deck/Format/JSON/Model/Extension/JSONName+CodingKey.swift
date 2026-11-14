//
//  JSONName+CodingKey.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// A name as the key of a keyed container, for an object of any names.
extension JSONName: CodingKey {
    // MARK: - Property
    public var stringValue: String {
        text
    }

    public var intValue: Int? {
        nil
    }

    // MARK: - Initializer
    public init(stringValue: String) {
        self.init(stringValue)
    }

    public init?(intValue: Int) {
        nil
    }

    // MARK: - Public
    // MARK: - Private
}
