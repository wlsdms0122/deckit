//
//  RouteParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct RouteParams: Decodable {
    // MARK: - Property
    let url: String
    // Whether the caller may hand a file on, to a mod or to the file's app.
    let opensFiles: Bool
    // Whether it skips the mods for what deckit opens it with by itself.
    let usesDefaultApp: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
