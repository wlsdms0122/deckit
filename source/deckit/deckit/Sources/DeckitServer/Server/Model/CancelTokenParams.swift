//
//  CancelTokenParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// A command token, by its id, and the mod that asks to end it.
struct CancelTokenParams: Decodable {
    // MARK: - Property
    let mod: String
    let token: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
