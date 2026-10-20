//
//  Manifest.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a manifest says, read whatever is wrong with it, so what shows the mod that does not load can name it.
public struct Manifest: Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    public let version: String?
    public let api: String?
    public let main: String?
    // Mod id -> the version wanted: what it runs only with.
    public let requires: [String: String]
    // Mod id -> the version wanted: what it runs without.
    public let optional: [String: String]
    public let permissions: [PermissionRequest]
    // What the layers' fields hold, by the key each is held under.
    public let fields: [String: any Encodable & Sendable]

    // MARK: - Initializer
    // MARK: - Public
    // Whether `other` is at a version its [optional] names for it.
    func takesOptional(_ other: Manifest) -> Bool {
        guard let wanted = optional[other.id].flatMap(Version.init),
            let version = other.version.flatMap(Version.init)
        else { return false }

        return version.satisfies(wanted)
    }

    // What the manifest holds of a field the layer that asks added to deck: the reader reads each added field into it.
    public func value<Field: ManifestField>(of field: Field) -> Field.Value {
        fields[field.key] as! Field.Value
    }

    // MARK: - Private
}
