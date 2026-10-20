//
//  SettingChange.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a setting was set to, and whether that changed it.
struct SettingChange: Encodable, Equatable, Sendable {
    // MARK: - Property
    let value: SettingValue
    let changed: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
