//
//  ExtensionError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

public enum ExtensionError: DeckError, Equatable {
    case notAPoint(String, of: String)
    case notRunning(String)
    case notExtending(mod: String, point: String)
    case noSuchFunction(mod: String, point: String, path: [String])

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notAPoint(point, mod):
            "\(point) is not a point of \(mod)"

        case let .notRunning(mod):
            "\(mod) is not running"

        case let .notExtending(mod, point):
            "\(mod) does not extend \(point)"

        case let .noSuchFunction(mod, point, path):
            "\(mod) extends \(point) with no function \(path.joined(separator: "."))"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
