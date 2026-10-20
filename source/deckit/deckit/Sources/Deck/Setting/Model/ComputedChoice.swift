//
//  ComputedChoice.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One of a mod's choices, with the options its page worked out for it. Options its page answered that are not
// options read as none, so one mod's page never keeps another's settings from being listed.
struct ComputedChoice: Decodable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case key
        case options
    }

    let mod: String
    let key: String
    let options: [SettingOption]

    // MARK: - Initializer
    init(mod: String, key: String, options: [SettingOption]) {
        self.mod = mod
        self.key = key
        self.options = options
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.mod = try container.decode(String.self, forKey: .mod)
        self.key = try container.decode(String.self, forKey: .key)
        self.options = (try? container.decode([SettingOption].self, forKey: .options)) ?? []
    }

    // MARK: - Public
    // MARK: - Private
}
