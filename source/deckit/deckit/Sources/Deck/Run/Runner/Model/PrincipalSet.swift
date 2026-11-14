//
//  PrincipalSet.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// Principals named by id: those listed, or every principal.
public enum PrincipalSet: Equatable, Sendable {
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
