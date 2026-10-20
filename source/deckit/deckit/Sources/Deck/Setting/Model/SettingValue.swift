//
//  SettingValue.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a setting is set to: on or off, a number, or text.
public enum SettingValue: Equatable, Sendable {
    case bool(Bool)
    case number(Double)
    case string(String)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
