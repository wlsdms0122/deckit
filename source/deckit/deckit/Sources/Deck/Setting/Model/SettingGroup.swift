//
//  SettingGroup.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod's settings as Settings lists them, under the mod's name.
public struct SettingGroup: Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    public let items: [SettingItem]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
