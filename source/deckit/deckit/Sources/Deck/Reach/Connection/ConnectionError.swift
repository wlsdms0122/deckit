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
    // The lifecycle has ended, or has not begun.
    case lifecycleEnded(Endpoint)
    case ownId(String)
    case outOfReach(principal: String, client: String)
    // The principal runs with no exports for the name that reach the lifecycle that reaches it by it.
    case notExported(name: String, principal: String)
    // The owner of the interface does not provide the major the lifecycle that reaches it by it uses.
    case unsupportedVersion(name: String, principal: String, major: Int)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notRunning(principal):
            "\(principal) is not running"

        case .ended:
            "the other end has ended"

        case let .notAnEnd(principal):
            "\(principal) is not an end of that connection"

        case let .lifecycleEnded(endpoint):
            "lifecycle \(endpoint.lifecycle) of run \(endpoint.run) of \(endpoint.principal) has ended or has not begun"

        case let .ownId(principal):
            "\(principal) reaches no one by its own id"

        case let .outOfReach(principal, client):
            "\(client) may not reach \(principal) by id"

        case let .notExported(name, principal):
            "\(principal) runs with no exports for \(name) that reach the lifecycle"

        case let .unsupportedVersion(name, principal, major):
            "\(principal) does not provide major \(major) of \(name)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
