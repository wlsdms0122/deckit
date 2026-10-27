//
//  ConfigurationChange.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation

// What a configuration was set to, and whether that changed it.
public struct ConfigurationChange: Equatable, Sendable {
    // MARK: - Property
    public let value: ConfigurationValue
    public let changed: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
