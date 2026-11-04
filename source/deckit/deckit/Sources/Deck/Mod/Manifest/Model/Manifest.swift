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
    // Interface -> the version of it the mod implements.
    public let implements: [String: String]
    // Interface -> how the mod depends on it.
    public let dependencies: [String: Dependency]
    public let permissions: [PermissionRequest]
    // What the layers' fields hold, by the key each is held under.
    let fields: [String: any Sendable]

    // MARK: - Initializer
    // MARK: - Public
    // The interfaces it runs only with.
    public var required: [String] {
        dependencies.filter { _, dependency in !dependency.optional }.keys.sorted()
    }

    // What the manifest holds of a field the layer that asks added to deck: the reader reads each added field into it.
    public func value<Field: ManifestField>(of field: Field) -> Field.Value {
        fields[field.key] as! Field.Value
    }

    // MARK: - Private
}
