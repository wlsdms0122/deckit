//
//  Connection.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A lifecycle of a mod and the exports the implementation picked for an interface it names in its [dependencies]
// opened for that interface, joined from when both are up until either ends. What crosses it, values and the functions
// each end hands the other, is the two pages'.
public struct Connection: Equatable, Sendable {
    // MARK: - Property
    public let id: Int
    // The name the dependent reaches the exports by.
    public let name: String
    // The lifecycle that depends on the interface.
    public let dependent: Endpoint
    // The lifecycle that opened the exports it reaches.
    public let dependency: Endpoint
    // Whether the dependent runs only with an implementation of the interface.
    public let required: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
