//
//  Mod.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod as deck found it: what its manifest says, where it is, and whether it loads.
public struct Mod: Sendable {
    // MARK: - Property
    public let manifest: Manifest
    public let folder: URL
    // The folder it keeps its own data in, which is not there until it writes.
    public let data: URL
    // Whether it is a copy in deck's mods folder.
    public let installed: Bool
    // Whether the app ships it: a copy installed of what it shipped, or what it ships and did not install, read where
    // it ships it. A mod neither installed nor shipped is read in place from a source folder.
    public let shipped: Bool
    // Why it does not load, or nil when it does.
    public internal(set) var problem: String?
    // Folders of the same id that are not read.
    public internal(set) var hides: [URL]
    // Two reads of a mod with one revision are the same code: a copy installed again, even of the same version, is
    // not.
    public let revision: String
    // The mods its manifest's [dependencies] names, by id, each with whether it is optional.
    public internal(set) var relations: [Relation]
    // The mods that load and require it, directly or through another, by id.
    public internal(set) var dependents: [String]
    // The file its main names, where it really is.
    public let entry: URL?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
