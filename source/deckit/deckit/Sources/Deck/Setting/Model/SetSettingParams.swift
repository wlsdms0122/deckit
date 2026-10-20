//
//  SetSettingParams.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A value asked for a mod's setting, and for a computed choice the options its page worked out.
struct SetSettingParams: Decodable {
    // MARK: - Property
    let mod: String
    let key: String
    let value: SettingValue?
    let options: [SettingOption]?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
