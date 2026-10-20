//
//  HandlerPreference.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// How the person arranged a scheme's handlers: those placed, in order, and those switched off.
struct HandlerPreference: Codable, Sendable {
    // MARK: - Property
    let order: [String]
    let off: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
