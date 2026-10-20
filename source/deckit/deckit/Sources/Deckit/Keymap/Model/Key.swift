//
//  Key.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A key as its owner declares it: the action it runs, its default chord as written, what a person reads it as, and
// whether it works wherever the keyboard is in the app.
public struct Key: Decodable, Equatable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case action
        case spec = "key"
        case label
        case global
    }

    let action: String
    let spec: String
    let label: String
    let global: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
