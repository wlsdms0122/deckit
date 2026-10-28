//
//  Endpoint.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// One end of a connection: a lifecycle of a mod's run, numbered from 0, the lowest stacked on the run.
public struct Endpoint: Hashable, Sendable {
    // MARK: - Property
    public let modId: String
    public let run: Int
    public let lifecycle: Int

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
