//
//  JSONName.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// The name of a member of a JSON object. Two names are one name only when they are the same sequence of Unicode
// scalar values, with nothing normalized, and one comes before another by the scalar values at the first place they
// differ, the shorter first where one begins the other.
public struct JSONName: Hashable, Comparable, Sendable, ExpressibleByStringLiteral {
    // MARK: - Property
    public let text: String

    // MARK: - Initializer
    public init(_ text: String) {
        self.text = text
    }

    public init(stringLiteral text: String) {
        self.init(text)
    }

    // MARK: - Public
    public static func == (name: JSONName, other: JSONName) -> Bool {
        name.text.unicodeScalars.elementsEqual(other.text.unicodeScalars)
    }

    public static func < (name: JSONName, other: JSONName) -> Bool {
        name.text.unicodeScalars.lexicographicallyPrecedes(other.text.unicodeScalars)
    }

    public func hash(into hasher: inout Hasher) {
        for scalar in text.unicodeScalars {
            hasher.combine(scalar.value)
        }
        hasher.combine(text.unicodeScalars.count)
    }

    // MARK: - Private
}
