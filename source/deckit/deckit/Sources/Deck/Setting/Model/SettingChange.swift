//
//  SettingChange.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a setting was set to, and whether that changed it.
public struct SettingChange: Encodable, Equatable, Sendable {
    // MARK: - Property
    public let value: SettingValue
    public let changed: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
