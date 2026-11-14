//
//  Effect.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What the driver does, in order, with what deck decided of the runs.
public enum Effect: Sendable {
    // Make the principal's sandbox for the job, on what hosts its runs: a page, not loaded yet, or the transport
    // connection the job names, bound to the principal from now on.
    case open(Job)
    // Load the principal's page at its address: a page the driver knows has just loaded by itself is left as it is,
    // and a transport connection loads nothing.
    case loadPage(principal: String)
    // Keep the run as it is now, and tell whoever observes it.
    case tell(LifecycleNotification, Run)
    // Keep the run as it is now: what changed is no step of it.
    case keep(Run)
    // Ask what hosts the run to end it, and say once it did, its time ran out or it is gone.
    case stop(principal: String, number: Int)
    // End the principal's sandbox at once, asking nothing of what hosts it: what its page runs ends, and its next
    // launch loads its page anew; a transport connection closes.
    case kill(principal: String)
    // Close the principal's sandbox, which runs no more, and what hosts it.
    case close(principal: String)
    // Ask the service's page for the exports the connection reaches, telling it the client's credential, and hand them
    // to the client's.
    case connect(Connection)
    // Tell both pages the connection has ended.
    case disconnect(Connection)
    // Tell the listeners' pages the event.
    case deliver(EventDelivery)
    // The client lifecycle reaches `service` by `name`, and `service` does not run: deck does not launch it.
    case wait(name: String, client: Endpoint, service: String)
    // Tell the client lifecycle's page it is refused what it reaches by `name`, as `refusal` says: the interface's
    // owner does not provide the major it uses, or the principal runs with no exports for the name that reach the
    // lifecycle.
    case refuse(name: String, client: Endpoint, refusal: ConnectionError)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
