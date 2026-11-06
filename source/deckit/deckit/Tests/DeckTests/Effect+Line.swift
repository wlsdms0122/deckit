//
//  Effect+Line.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
@testable import Deck

extension Effect {
    // MARK: - Property
    // The effect in one line, as a test compares it.
    var line: String {
        switch self {
        case let .open(job):
            "open \(job.modId)"

        case let .loadPage(modId):
            "loadPage \(modId)"

        case let .tell(notification, run):
            [
                "tell",
                notification.rawValue,
                run.modId,
                String(run.number),
                run.state.rawValue
            ]
                .joined(separator: " ")

        case let .keep(run):
            "keep \(run.modId) \(run.number) \(run.problem ?? "")"

        case let .stop(modId, number):
            "stop \(modId) \(number)"

        case let .close(modId):
            "close \(modId)"

        case let .connect(connection):
            "connect \(connection.line)"

        case let .disconnect(connection):
            "disconnect \(connection.line)"

        case let .deliver(delivery):
            "deliver \(delivery.name) to \(delivery.listeners.joined(separator: ", "))"

        case let .wait(name, dependent, provider):
            "wait \(dependent.modId)#\(dependent.run)@\(dependent.lifecycle) for \(provider) by \(name)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
