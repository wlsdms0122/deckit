//
//  SettingType.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The kinds of setting a mod declares.
public enum SettingType: String, Codable, Sendable {
    case toggle
    case number
    case text
    case choice
    case action

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
