//
//  ConfigurationType.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation

// The JSON Schema types a configuration is declared with.
public enum ConfigurationType: String, Codable, Sendable {
    case boolean
    case number
    case string

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
