//
//  Mod.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

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
    // Whether it is in the startup list: its manifest asks to run in the background and the person approved it.
    public let startupApproved: Bool
    // Why it does not load, or nil when it does.
    public internal(set) var problem: String?
    // Folders of the same id that are not read.
    public internal(set) var hides: [URL]
    // Two reads of a mod with one revision are the same code: a copy installed again, even of the same version, is
    // not.
    public let revision: String
    // The mods its manifest's [dependencies] names, by id, each with whether it is optional.
    public internal(set) var relations: [Relation]
    // The interfaces its manifest's `uses` names, by name, each with what it comes to.
    public internal(set) var uses: [InterfaceUse]
    // The mods that load and require it, directly or through another, by id.
    public internal(set) var dependents: [String]
    // The file its main names, where it really is.
    public let entry: URL?
    // What the file its contributes names declares, by contribution point: deck reads it and does not judge it, and
    // the layer that owns a contribution point reads what is under it.
    public let contributes: [String: JSONValue]
    // What it declares to interfaces under `interfaces` in its contributes, which deck holds for each one's owner.
    public let declared: InterfaceDeclaration
    // What is wrong with what it declares, deck's and each layer's, once it loads: each declaration it names is left
    // out.
    public internal(set) var declarationProblems: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
