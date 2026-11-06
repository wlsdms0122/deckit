//
//  LaunchParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// The mod `mod` launches as asked, `by` the mod that asks, or none.
struct LaunchParams: Decodable {
    // MARK: - Property
    let mod: String
    let by: String?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
