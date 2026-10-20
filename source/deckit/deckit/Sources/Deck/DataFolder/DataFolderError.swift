//
//  DataFolderError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

enum DataFolderError: CallError, Equatable {
    case notAMod(String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .notAMod:
            "MOD"
        }
    }

    var message: String {
        switch self {
        case let .notAMod(mod):
            "not a mod id: \(mod)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
