//
//  Connection.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A lifecycle of a mod and the exports of a mod it names in its [dependencies], joined from when both are up until
// either ends. What crosses it, values and the functions each end hands the other, is the two pages'.
public struct Connection: Equatable, Sendable {
    // MARK: - Property
    public let id: Int
    // The lifecycle that depends on the other mod.
    public let dependent: Endpoint
    // The lifecycle that opened the exports it reaches.
    public let dependency: Endpoint
    // Whether the dependent runs only with that mod.
    public let required: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
