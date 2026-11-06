//
//  LaunchOrigin.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// Why a run was launched, as the request that launched it said: deck records it and does not act on it.
public enum LaunchOrigin: Equatable, Sendable {
    // The person opened the mod.
    case person
    // The mod is in the startup list.
    case startup
    // A mod that requires it by id launched, by that mod's id.
    case required(by: String)
    // Work that needed the mod, as the layer that asked for it describes it, carried and not read, and the mod that
    // asked for it, if any.
    case work(JSONValue, mod: String?)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
