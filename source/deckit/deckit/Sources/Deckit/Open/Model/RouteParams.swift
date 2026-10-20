//
//  RouteParams.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct RouteParams: Decodable {
    // MARK: - Property
    let url: String
    // Whether a person's click or key asked for it.
    let userInitiated: Bool
    // Whether it skips the mods for what deckit opens it with by itself.
    let usesDefaultApp: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
