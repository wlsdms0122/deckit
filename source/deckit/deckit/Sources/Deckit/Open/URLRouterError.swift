//
//  URLRouterError.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

public enum URLRouterError: Refusal, Equatable {
    case noHandlers(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .noHandlers(scheme):
            "no mod handles \(scheme)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
