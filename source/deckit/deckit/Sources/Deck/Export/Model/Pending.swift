//
//  Pending.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The run what is asked waits on: asked again once the mod's latest run is no longer the `run`th in `state`.
struct Pending: Encodable, Equatable, Sendable {
    // MARK: - Property
    let mod: String
    let run: Int
    let state: RunState

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
