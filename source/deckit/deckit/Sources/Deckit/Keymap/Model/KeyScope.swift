//
//  KeyScope.swift
//  Deckit
//
//  Created by JSilver on 10/24/26.
//

import Foundation

// Where a key works: `local` in the page in front (a mod's in its own page, the app's in any), `app` anywhere in the
// app, `global` in every app too. A narrower scope takes a chord first where it works. A key past its page is taken
// from every page, text fields included.
public enum KeyScope: String, Codable, Sendable {
    case local
    case app
    case global

    // MARK: - Property
    // Whether it works past its page, taken from every page, so held to `Keystroke.wideRule`.
    var isWide: Bool {
        self != .local
    }

    // How a person reads where it works.
    var phrase: String {
        switch self {
        case .local:
            "in the page in front"

        case .app:
            "anywhere in the app"

        case .global:
            "in every app"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
