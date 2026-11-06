//
//  Permission+Key.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension Permission {
    // MARK: - Property
    // What a mod holds for its keys to work past its own page: anywhere in the app, taken from every page there, or in
    // every app.
    static let appKeys = Permission(
        id: "deckit.app-keys",
        name: "App Keys",
        means: "Its keys work wherever you are in the app, whatever is in front, and are taken from every page there."
    )
    static let globalKeys = Permission(
        id: "system.global-keys",
        name: "Global Keys",
        means: "Its keys work in every app, this one in front or not, and are taken from all of them."
    )

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
