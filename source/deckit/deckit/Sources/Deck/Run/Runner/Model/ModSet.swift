//
//  ModSet.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// Mods named by id: those listed, or every mod.
public enum ModSet: Equatable, Sendable {
    case only([String])
    case every

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    func contains(_ id: String) -> Bool {
        switch self {
        case let .only(ids):
            ids.contains(id)

        case .every:
            true
        }
    }

    // MARK: - Private
}
