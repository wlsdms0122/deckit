//
//  ReachParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// The `lifecycle`th lifecycle of the `run`th run of a mod, and the mod `target` it reaches by id.
struct ReachParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let lifecycle: Int
    let target: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
