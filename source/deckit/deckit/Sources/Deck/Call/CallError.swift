//
//  CallError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A call refused, with the kind the far side reads it by.
public struct CallError: Error, Equatable, Sendable {
    // MARK: - Property
    public let kind: String?
    public let message: String

    // MARK: - Initializer
    public init(kind: String? = nil, message: String) {
        self.kind = kind
        self.message = message
    }

    // MARK: - Public
    // MARK: - Private
}
