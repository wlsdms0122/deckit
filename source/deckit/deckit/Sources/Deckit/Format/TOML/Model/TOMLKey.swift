//
//  TOMLKey.swift
//  Deckit
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Deck

// A key as a manifest writes it. Two keys are one key only when they are the same sequence of Unicode scalar values,
// with nothing normalized, and one comes before another by the scalar values at the first place they differ, the
// shorter first where one begins the other. A field's name and a permission's id compare as keys do.
public struct TOMLKey: Hashable, Comparable, Sendable, ExpressibleByStringLiteral {
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
    public static func == (key: TOMLKey, other: TOMLKey) -> Bool {
        key.text.unicodeScalars.elementsEqual(other.text.unicodeScalars)
    }

    public static func < (key: TOMLKey, other: TOMLKey) -> Bool {
        key.text.unicodeScalars.lexicographicallyPrecedes(other.text.unicodeScalars)
    }

    public func hash(into hasher: inout Hasher) {
        for scalar in text.unicodeScalars {
            hasher.combine(scalar.value)
        }
        hasher.combine(text.unicodeScalars.count)
    }

    // MARK: - Private
}
