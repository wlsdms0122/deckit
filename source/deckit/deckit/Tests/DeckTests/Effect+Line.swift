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
            "open \(job.principal)"

        case let .loadPage(principal):
            "loadPage \(principal)"

        case let .tell(notification, run):
            [
                "tell",
                notification.rawValue,
                run.principal,
                String(run.number),
                run.state.rawValue
            ]
                .joined(separator: " ")

        case let .keep(run):
            "keep \(run.principal) \(run.number) \(run.problem ?? "")"

        case let .stop(principal, number):
            "stop \(principal) \(number)"

        case let .kill(principal):
            "kill \(principal)"

        case let .close(principal):
            "close \(principal)"

        case let .connect(connection):
            "connect \(connection.line)"

        case let .disconnect(connection):
            "disconnect \(connection.line)"

        case let .deliver(delivery):
            "deliver \(delivery.name) to \(delivery.listeners.joined(separator: ", "))"

        case let .wait(name, client, service):
            "wait \(client.principal)#\(client.run)@\(client.lifecycle) for \(service) by \(name)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
