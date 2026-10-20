//
//  SettingKey.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One of a mod's settings.
struct SettingKey: Encodable, Equatable, Sendable {
    // MARK: - Property
    let mod: String
    let key: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
