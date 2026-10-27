//
//  ConfigurationItem.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation

// A configuration as it is listed: its declaration, and the value it reads as.
public struct ConfigurationItem: Sendable {
    // MARK: - Property
    public let declaration: ConfigurationDeclaration
    public let value: ConfigurationValue?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
