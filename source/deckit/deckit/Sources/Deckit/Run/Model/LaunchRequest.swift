//
//  LaunchRequest.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// A request that the mod `modId` run, and why: the run it launches keeps `origin`.
public struct LaunchRequest: Sendable {
    // MARK: - Property
    public let modId: String
    public let origin: LaunchOrigin

    // MARK: - Initializer
    public init(modId: String, origin: LaunchOrigin) {
        self.modId = modId
        self.origin = origin
    }

    // MARK: - Public
    // MARK: - Private
}
