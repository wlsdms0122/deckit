//
//  Call.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What the driver asks of the core: a method by name and its params.
public struct Call: Sendable {
    // MARK: - Property
    public let method: String
    public let params: JSONValue

    // MARK: - Initializer
    public init(method: String, params: JSONValue = .null) {
        self.method = method
        self.params = params
    }

    // MARK: - Public
    // MARK: - Private
}
