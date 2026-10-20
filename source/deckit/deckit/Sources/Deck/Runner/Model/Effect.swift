//
//  Effect.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What the driver does, in order, with what deck decided of the runs.
enum Effect: Sendable {
    // Make the mod's sandbox, its page not loaded yet.
    case open(Mod)
    // Load the mod's page at its address.
    case load(modId: String)
    // Keep the run as it is now, and tell whoever observes it.
    case tell(LifecycleNotification, Run)
    // Keep the run as it is now: what changed is no step of it.
    case keep(Run)
    // Ask the run's stop() of its page, and say once it answered, its time ran out or the page is gone.
    case stop(modId: String, number: Int)
    // The mod's sandbox is going.
    case closing(modId: String)
    // Close the mod's sandbox, which runs no more.
    case close(modId: String, reason: TerminateReason)
    // Every run has ended for the quit: the app may quit.
    case quit
    // Tell the mod's run what an optional dependency of its exports to it now, or that it exports nothing.
    case optionalChanged(modId: String, dependency: String, exports: Snapshot?)
    // Tell the mod's `run`th run what extends its extension point `name` now, by the id of the mod that extends it.
    case extensionsChanged(modId: String, run: Int, name: String, extensions: [String: Snapshot])
    // The scoped names of the points the mod extends now.
    case extendsChanged(modId: String, points: [String])

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
