//
//  ConfigurationGroup.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation

// A mod's configuration as it is listed, under the mod's name.
public struct ConfigurationGroup: Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    public let items: [ConfigurationItem]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
