//
//  WriteSettingParams.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct WriteSettingParams: Decodable {
    // MARK: - Property
    let mod: String
    let key: String
    let value: SettingValue

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
