//
//  Effect+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// Each as `effect`, its name, with the mod's id as `mod` and a run's number as `run`, as main names them in what it
// asks; the mod a sandbox opens for is `found`, as the catalog reads it. A layer's change is named by what it is: the
// keymap is `bindingsChanged`.
extension Effect: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case effect
        case mod
        case found
        case notification
        case run
        case state
        case problem
        case endReason
        case summary
        case contributions
        case dependency
        case exports
        case name
        case extensions
        case points
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .open(mod):
            try container.encode("open", forKey: .effect)
            try container.encode(mod.manifest.id, forKey: .mod)
            try container.encode(mod, forKey: .found)

        case let .loadPage(modId):
            try container.encode("loadPage", forKey: .effect)
            try container.encode(modId, forKey: .mod)

        case let .tell(notification, run):
            try container.encode("tell", forKey: .effect)
            try container.encode(notification, forKey: .notification)
            try encode(run, in: &container)

        case let .keep(run):
            try container.encode("keep", forKey: .effect)
            try encode(run, in: &container)

        case let .stop(modId, number):
            try container.encode("stop", forKey: .effect)
            try container.encode(modId, forKey: .mod)
            try container.encode(number, forKey: .run)

        case let .close(modId):
            try container.encode("close", forKey: .effect)
            try container.encode(modId, forKey: .mod)

        case let .optionalChanged(modId, dependency, exports):
            try container.encode("optionalChanged", forKey: .effect)
            try container.encode(modId, forKey: .mod)
            try container.encode(dependency, forKey: .dependency)
            try container.encode(exports, forKey: .exports)

        case let .extensionsChanged(modId, run, name, extensions):
            try container.encode("extensionsChanged", forKey: .effect)
            try container.encode(modId, forKey: .mod)
            try container.encode(run, forKey: .run)
            try container.encode(name, forKey: .name)
            try container.encode(extensions, forKey: .extensions)

        case let .extendsChanged(modId, points):
            try container.encode("extendsChanged", forKey: .effect)
            try container.encode(modId, forKey: .mod)
            try container.encode(points, forKey: .points)

        case let .layer(keymap as ResolvedKeymap):
            try keymap.encode(to: encoder)
            try container.encode("bindingsChanged", forKey: .effect)

        case let .layer(change):
            let context = EncodingError.Context(codingPath: encoder.codingPath, debugDescription: "no effect names it")
            throw EncodingError.invalidValue(change, context)
        }
    }

    // MARK: - Private
    private func encode(_ run: Run, in container: inout KeyedEncodingContainer<CodingKeys>) throws {
        try container.encode(run.modId, forKey: .mod)
        try container.encode(run.number, forKey: .run)
        try container.encode(run.state, forKey: .state)
        try container.encodeIfPresent(run.problem, forKey: .problem)
        try container.encodeIfPresent(run.endReason, forKey: .endReason)
        try container.encodeIfPresent(run.summary, forKey: .summary)
        try container.encodeIfPresent(run.contributions, forKey: .contributions)
    }
}
