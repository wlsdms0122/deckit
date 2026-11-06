//
//  Manifest.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// What a manifest says, read whatever is wrong with it, so what shows the mod that does not load can name it.
public struct Manifest: Sendable {
    // MARK: - Property
    public let id: String
    // Whether the manifest names the id: one that does not stands under the id its reader was handed for it.
    public let namesID: Bool
    public let name: String
    public let version: String?
    public let api: String?
    public let main: String?
    // The file of what it declares by contribution point, a JSON object, which deck reads before the mod runs.
    public let contributes: String?
    // Why it asks to run in the background, when it asks: the person approves it or not.
    public let background: String?
    // Interface -> the majors of it the mod provides.
    public let provides: [String: [Int]]
    // Interface -> the major of it the mod uses.
    public let uses: [String: Int]
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
        dependencies[other.id]?.isSatisfied(by: other) ?? false
    }

    // What the manifest holds of a field the layer that asks added to deck: the reader reads each added field into it.
    public func value<Field: ManifestField>(of field: Field) -> Field.Value {
        fields[field.key] as! Field.Value
    }

    // MARK: - Private
}
