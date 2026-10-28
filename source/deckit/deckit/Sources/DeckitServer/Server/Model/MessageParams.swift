//
//  MessageParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A message from the `run`th run of `mod` on a connection, by its id.
struct MessageParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let connection: Int

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
