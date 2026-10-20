//
//  Manifest.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a manifest says, read whatever is wrong with it, so what shows the mod that does not load can name it.
struct Manifest: Sendable {
    // MARK: - Property
    let id: String
    let name: String
    let version: String?
    let api: String?
    let main: String?
    // Mod id -> the version wanted: what it runs only with.
    let requires: [String: String]
    // Mod id -> the version wanted: what it runs without.
    let optional: [String: String]
    let permissions: [PermissionRequest]
    // What the layers' fields hold, by the key each is held under.
    let fields: [String: any Encodable & Sendable]

    // MARK: - Initializer
    // MARK: - Public
    // Whether `other` is at a version its [optional] names for it.
    func takesOptional(_ other: Manifest) -> Bool {
        guard let wanted = optional[other.id].flatMap(Version.init),
            let version = other.version.flatMap(Version.init)
        else { return false }

        return version.satisfies(wanted)
    }

    // MARK: - Private
}
