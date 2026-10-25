//
//  CommandError.swift
//  Deckit
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deck

public enum CommandError: Refusal, Equatable {
    case notAName(String)
    case declaration(name: String, why: String)
    case schema(String)
    case defined(String)
    case noSuchCommand(String)
    case arguments(command: String, why: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notAName(name):
            "\"\(name)\" is no name: a name has letters, digits, \"_\" and \"-\""

        case let .declaration(name, why):
            "command \"\(name)\" cannot be used: \(why)"

        case let .schema(why):
            "a schema \(why)"

        case let .defined(id):
            "\(id) is declared already"

        case let .noSuchCommand(id):
            "no such command: \(id)"

        case let .arguments(command, why):
            "\(command) cannot run: \(why)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
