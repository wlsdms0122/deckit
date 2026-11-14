//
//  Mod+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// Its folders as paths, the ids of the permissions it is granted, and why it does not load as its message and its
// kind, the kind absent for a problem that is no refusal.
extension Mod: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case manifest
        case folder
        case data
        case installed
        case shipped
        case system
        case granted
        case problem
        case hides
        case revision
        case uses
        case entry
    }

    private enum ProblemKeys: String, CodingKey {
        case message
        case kind
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
        try container.encode(granted, forKey: .granted)
        if let problem {
            var why = container.nestedContainer(keyedBy: ProblemKeys.self, forKey: .problem)
            let refusal = problem as? any Refusal
            try why.encode(refusal?.message ?? problem.localizedDescription, forKey: .message)
            try why.encodeIfPresent(refusal?.kind, forKey: .kind)
        }
        try container.encode(hides.map { hidden in hidden.path(percentEncoded: false) }, forKey: .hides)
        try container.encode(revision, forKey: .revision)
        try container.encode(uses, forKey: .uses)
        try container.encodeIfPresent(entry?.path(percentEncoded: false), forKey: .entry)
    }

    // MARK: - Private
}
