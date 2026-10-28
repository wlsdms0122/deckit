//
//  LifecycleParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// The `lifecycle`th lifecycle of the `run`th run of a mod.
struct LifecycleParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let lifecycle: Int

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
