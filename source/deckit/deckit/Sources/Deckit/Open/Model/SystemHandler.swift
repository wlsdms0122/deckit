//
//  SystemHandler.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What deckit opens an address with by itself, after every mod that takes its scheme: the web in the system browser, a
// file in its app.
public enum SystemHandler: String, Encodable, Sendable {
    case browser
    case file

    // MARK: - Property
    // The schemes deckit opens by itself, in the order their handler lists come.
    static let schemes: [(scheme: String, handler: SystemHandler)] = [
        ("http", .browser),
        ("https", .browser),
        ("file", .file)
    ]

    // MARK: - Initializer
    init?(scheme: String) {
        guard let found = Self.schemes.first(where: { entry in entry.scheme == scheme }) else { return nil }
        self = found.handler
    }

    // MARK: - Public
    // MARK: - Private
}
