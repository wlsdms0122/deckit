//
//  CallExtensionParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A call from the `run`th run of `caller` into the function at `path` of what `mod` extends `point` with.
struct CallExtensionParams: Decodable {
    // MARK: - Property
    let caller: String
    let run: Int
    let mod: String
    let point: String
    let path: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
