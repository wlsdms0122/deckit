//
//  Effect.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What the driver does, in order, with what deck decided of the runs.
public enum Effect: Sendable {
    // Make the mod's sandbox for the job, its page not loaded yet.
    case open(Job)
    // Load the mod's page at its address: a page the driver knows has just loaded by itself is left as it is.
    case loadPage(modId: String)
    // Keep the run as it is now, and tell whoever observes it.
    case tell(LifecycleNotification, Run)
    // Keep the run as it is now: what changed is no step of it.
    case keep(Run)
    // Ask the run's page to end it, and say once it did, its time ran out or the page is gone.
    case stop(modId: String, number: Int)
    // End the mod's sandbox at once, asking nothing of its page: what its page runs ends, and its next launch loads its
    // page anew.
    case kill(modId: String)
    // Close the mod's sandbox, which runs no more.
    case close(modId: String)
    // Ask the service's page for the exports the connection reaches, telling it the client's credential, and hand them
    // to the client's.
    case connect(Connection)
    // Tell both pages the connection has ended.
    case disconnect(Connection)
    // Tell the listeners' pages the event.
    case deliver(EventDelivery)
    // The client lifecycle reaches `service` by `name`, and `service` does not run: deck does not launch it.
    case wait(name: String, client: Endpoint, service: String)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
