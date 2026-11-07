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
    // Why it runs in the background, shown to the person before it is installed: a mod with one is a background mod.
    public let background: String?
    // Interface -> the majors of it the mod provides.
    public let provides: [String: [Int]]
    // Interface -> the major of it the mod uses.
    public let uses: [String: Int]
    public let permissions: [PermissionRequest]
    // Interface -> the entries the mod declares to it, each handed to the interface's owner as written.
    public let contributes: [String: [JSONValue]]
    // Field -> what the manifest writes of it, as JSON writes it, of the fields the layers on deck add: theirs to read.
    public let fields: [JSONName: JSONValue]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
