//
//  Pending.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The run what is asked waits on: asked again once the mod's latest run is no longer the `run`th in `state`.
public struct Pending: Equatable, Sendable {
    // MARK: - Property
    public let mod: String
    public let run: Int
    public let state: RunState

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
