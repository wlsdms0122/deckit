//
//  SchemeHandler.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod that opens a scheme's addresses, those its patterns match, asked unless the person switched it off.
public struct SchemeHandler: Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    // As its manifest writes them.
    public let patterns: [String]
    public let on: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
