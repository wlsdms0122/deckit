//
//  SetConfigurationParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

// A value asked for a mod's configuration.
struct SetConfigurationParams: Decodable {
    // MARK: - Property
    let mod: String
    let key: String
    let value: ConfigurationValue?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
