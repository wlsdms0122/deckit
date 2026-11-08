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
    case notAnEnd(principal: String)
    case notUp(Endpoint)
    case outOfReach(principal: String, client: String)
    // The principal runs with no exports for the name that reach the lifecycle that reaches it by it.
    case notExported(name: String, principal: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notRunning(principal):
            "\(principal) is not running"

        case .ended:
            "the other end has ended"

        case let .notAnEnd(principal):
            "\(principal) is not an end of that connection"

        case let .notUp(endpoint):
            "lifecycle \(endpoint.lifecycle) of run \(endpoint.run) of \(endpoint.principal) is not up"

        case let .outOfReach(principal, client):
            "\(client) may not reach \(principal) by id"

        case let .notExported(name, principal):
            "\(principal) runs with no exports for \(name) that reach the lifecycle"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
