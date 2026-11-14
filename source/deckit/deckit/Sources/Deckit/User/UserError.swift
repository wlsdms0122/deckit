//
//  UserError.swift
//  Deckit
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deck

public enum UserError: Refusal, Equatable {
    // The id is no name a principal goes by.
    case notAPrincipal(String)
    // A mod is listed under the id.
    case isMod(String)
    // No user record is kept for the id.
    case notAUser(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notAPrincipal(id):
            "not a principal: \(id)"

        case let .isMod(id):
            "\(id) is a mod"

        case let .notAUser(id):
            "no user is kept under \(id)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
