//
//  URLRouterError.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

enum URLRouterError: DeckError, Equatable {
    case noHandlers(String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .noHandlers:
            "SCHEME"
        }
    }

    var message: String {
        switch self {
        case let .noHandlers(scheme):
            "no mod handles \(scheme)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
