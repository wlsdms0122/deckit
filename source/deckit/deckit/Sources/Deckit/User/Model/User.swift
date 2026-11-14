//
//  User.swift
//  Deckit
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// A principal that sits at a seat, and the name a person reads it by.
public struct User: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let name: String

    // MARK: - Initializer
    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }

    // MARK: - Public
    // MARK: - Private
}
