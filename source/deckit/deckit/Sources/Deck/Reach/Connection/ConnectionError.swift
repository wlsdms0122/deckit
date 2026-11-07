//
//  ConnectionError.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

public enum ConnectionError: Refusal, Equatable {
    case notRunning(String)
    case ended
    case notAnEnd(mod: String)
    case notUp(Endpoint)
    case outOfReach(mod: String, client: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notRunning(mod):
            "\(mod) is not running"

        case .ended:
            "the mod on the other end has ended"

        case let .notAnEnd(mod):
            "\(mod) is not an end of that connection"

        case let .notUp(endpoint):
            "lifecycle \(endpoint.lifecycle) of run \(endpoint.run) of \(endpoint.modId) is not up"

        case let .outOfReach(mod, client):
            "\(client) may not reach \(mod) by id"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
