//
//  SettingOption.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One of what a choice offers. `absent` marks a saved value no option offers now, listed so it does not read as
// nothing chosen.
public struct SettingOption: Codable, Equatable, Sendable {
    // MARK: - Property
    public let value: SettingValue
    public let label: String
    public let font: String?
    public let absent: Bool?

    // MARK: - Initializer
    public init(value: SettingValue, label: String, font: String? = nil, absent: Bool? = nil) {
        self.value = value
        self.label = label
        self.font = font
        self.absent = absent
    }

    // MARK: - Public
    // MARK: - Private
}
