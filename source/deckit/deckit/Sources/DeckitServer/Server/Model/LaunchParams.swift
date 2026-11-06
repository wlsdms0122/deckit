//
//  LaunchParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// The mod `by` asks that the mod `mod` launch.
struct LaunchParams: Decodable {
    // MARK: - Property
    let mod: String
    let by: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
