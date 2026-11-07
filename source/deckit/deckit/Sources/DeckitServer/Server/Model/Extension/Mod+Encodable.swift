//
//  Mod+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// Its folders as paths.
extension Mod: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case manifest
        case folder
        case data
        case installed
        case shipped
        case system
        case problem
        case hides
        case revision
        case uses
        case entry
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(manifest, forKey: .manifest)
        try container.encode(folder.path(percentEncoded: false), forKey: .folder)
        try container.encode(data.path(percentEncoded: false), forKey: .data)
        try container.encode(installed, forKey: .installed)
        try container.encode(shipped, forKey: .shipped)
        try container.encode(system, forKey: .system)
        try container.encodeIfPresent(problem, forKey: .problem)
        try container.encode(hides.map { hidden in hidden.path(percentEncoded: false) }, forKey: .hides)
        try container.encode(revision, forKey: .revision)
        try container.encode(uses, forKey: .uses)
        try container.encodeIfPresent(entry?.path(percentEncoded: false), forKey: .entry)
    }

    // MARK: - Private
}
