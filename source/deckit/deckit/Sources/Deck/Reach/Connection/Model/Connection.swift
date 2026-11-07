//
//  Connection.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A lifecycle of a mod and the exports another mod opened for a name the first reaches by, a mod id or an interface, joined
// from when both are up until either ends. What crosses it, values and the functions each end hands the other, is the
// two pages'. The service end is told who the client is, its peer credential.
public struct Connection: Equatable, Sendable {
    // MARK: - Property
    public let id: Int
    // The mod id or the interface the client reaches the exports by.
    public let name: String
    // The lifecycle that reaches the exports.
    public let client: Endpoint
    // The lifecycle that opened the exports it reaches.
    public let service: Endpoint
    // The client's, taken from its job as the connection was made.
    public let credential: Credential

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
