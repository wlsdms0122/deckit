//
//  ConfigurationValue.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation

// What a configuration is set to: true or false, a number, or text.
public enum ConfigurationValue: Equatable, Sendable {
    case bool(Bool)
    case number(Double)
    case string(String)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
