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
    // Mod id -> how it depends on that mod.
    public let dependencies: [String: Dependency]
    public let permissions: [PermissionRequest]
    // What the layers' fields hold, by the key each is held under.
    let fields: [String: any Sendable]

    // MARK: - Initializer
    // MARK: - Public
    // The mods it runs only with, by id.
    public var required: [String] {
        dependencies.filter { _, dependency in !dependency.optional }.keys.sorted()
    }

    // Whether `other` is one of its dependencies, at the version it names for it.
    func depends(on other: Manifest) -> Bool {
        guard let wanted = dependencies[other.id].flatMap({ dependency in Version(dependency.version) }),
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
