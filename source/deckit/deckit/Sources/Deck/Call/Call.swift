//
//  Call.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A method asked of deck by name, and its params, read as the method needs them.
public struct Call: Sendable {
    // MARK: - Property
    public let method: String
    public let params: any CallParams

    // MARK: - Initializer
    public init(method: String, params: any CallParams) {
        self.method = method
        self.params = params
    }

    // MARK: - Public
    // MARK: - Private
}
