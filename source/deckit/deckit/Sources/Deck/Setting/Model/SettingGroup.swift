//
//  SettingGroup.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod's settings as Settings lists them, under the mod's name.
struct SettingGroup: Encodable, Sendable {
    // MARK: - Property
    let id: String
    let name: String
    let items: [SettingItem]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
