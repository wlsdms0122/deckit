//
//  Mod.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod as deck found it: what its manifest says, where it is, and whether it loads.
struct Mod: Sendable {
    // MARK: - Property
    let manifest: Manifest
    let folder: URL
    // Whether it is a copy in deck's mods folder.
    let installed: Bool
    // Whether the app ships it: a copy installed of what it shipped, or what it ships and did not install, read where
    // it ships it. A mod neither installed nor shipped is read in place from a source folder.
    let shipped: Bool
    // Why it does not load, or nil when it does.
    var problem: String?
    // Folders of the same id that are not read.
    var hides: [URL]
    // Two reads of a mod with one revision are the same code: a copy installed again, even of the same version, is
    // not.
    let revision: String
    var dependencies: [Dependency]
    // The file its main names, where it really is.
    let entry: URL?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
