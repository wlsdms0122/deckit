//
//  BindingScope.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Where a binding runs: anywhere a keystroke is heard, in the page in front, or in its mod's page in front.
enum BindingScope: String, Encodable, Sendable {
    case global
    case app
    case mod

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
