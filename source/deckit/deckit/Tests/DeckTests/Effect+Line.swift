//
//  Effect+Line.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
@testable import Deck

extension Effect {
    // MARK: - Property
    // The effect in one line, as a test compares it.
    var line: String {
        switch self {
        case let .open(mod):
            "open \(mod.manifest.id)"

        case let .load(modId):
            "load \(modId)"

        case let .tell(notification, run):
            [
                "tell",
                notification.rawValue,
                run.modId,
                String(run.number),
                run.state.rawValue,
                run.endReason?.rawValue
            ]
                .compactMap { part in part }
                .joined(separator: " ")

        case let .keep(run):
            "keep \(run.modId) \(run.number) \(run.problem ?? "")"

        case let .stop(modId, number):
            "stop \(modId) \(number)"

        case let .closing(modId):
            "closing \(modId)"

        case let .close(modId, reason):
            "close \(modId) \(reason.rawValue)"

        case .quit:
            "quit"

        case let .optionalChanged(modId, dependency, exports):
            "optionalChanged \(modId) \(dependency) \(exports == nil ? "none" : "exports")"

        case let .extensionsChanged(modId, run, name, extensions):
            "extensionsChanged \(modId) \(run) \(name) \(extensions.keys.sorted().joined(separator: ","))"

        case let .extendsChanged(modId, points):
            "extendsChanged \(modId) \(points.joined(separator: ","))"

        case let .layer(effect, _):
            "layer \(effect)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
