//
//  Credential.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// Who the client of a connection is, as its service is told: the client's mod id and the ids of the permissions granted
// to its job, handed as given.
public struct Credential: Equatable, Sendable {
    // MARK: - Property
    public let modId: String
    public let permissions: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
