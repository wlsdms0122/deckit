//
//  LaunchRequest.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// A request that the mod `modId` run.
public struct LaunchRequest: Sendable {
    // MARK: - Property
    public let modId: String

    // MARK: - Initializer
    public init(modId: String) {
        self.modId = modId
    }

    // MARK: - Public
    // MARK: - Private
}
