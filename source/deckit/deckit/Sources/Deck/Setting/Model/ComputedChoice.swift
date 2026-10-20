//
//  ComputedChoice.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One of a mod's choices, with the options its page worked out for it.
public struct ComputedChoice: Sendable {
    // MARK: - Property
    public let mod: String
    public let key: String
    public let options: [SettingOption]

    // MARK: - Initializer
    public init(mod: String, key: String, options: [SettingOption]) {
        self.mod = mod
        self.key = key
        self.options = options
    }

    // MARK: - Public
    // MARK: - Private
}
