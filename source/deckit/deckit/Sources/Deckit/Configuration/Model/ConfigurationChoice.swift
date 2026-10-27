//
//  ConfigurationChoice.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation

// One of the values a configuration declared with `oneOf` takes, and its title as a person reads it.
public struct ConfigurationChoice: Codable, Equatable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case value = "const"
        case title
    }

    public let value: ConfigurationValue
    public let title: String?

    // MARK: - Initializer
    public init(value: ConfigurationValue, title: String? = nil) {
        self.value = value
        self.title = title
    }

    // MARK: - Public
    // MARK: - Private
}
