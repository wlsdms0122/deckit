//
//  KeyReach.swift
//  Deckit
//
//  Created by JSilver on 10/24/26.
//

import Foundation

// How far a key works: in the page in front (a mod's in its own page, the app's in any), anywhere in the app, or in
// every app too. A key that reaches past its page is taken from every page, text fields included.
public enum KeyReach: String, Codable, Sendable {
    case front
    case app
    case system

    // MARK: - Property
    // Whether it works past its page, taken from every page, so held to `Keystroke.wideRule`.
    var isWide: Bool {
        self != .front
    }

    // How a person reads where it works.
    var phrase: String {
        switch self {
        case .front:
            "in the page in front"

        case .app:
            "anywhere in the app"

        case .system:
            "in every app"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
