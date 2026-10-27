//
//  Effect.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What the driver does, in order, with what deck decided of the runs.
public enum Effect: Sendable {
    // Make the mod's sandbox, its page not loaded yet.
    case open(Mod)
    // Load the mod's page at its address: a page the driver knows has just loaded by itself is left as it is.
    case loadPage(modId: String)
    // Keep the run as it is now, and tell whoever observes it.
    case tell(LifecycleNotification, Run)
    // Keep the run as it is now: what changed is no step of it.
    case keep(Run)
    // Ask the run's page to end it, and say once it did, its time ran out or the page is gone.
    case stop(modId: String, number: Int)
    // Close the mod's sandbox, which runs no more.
    case close(modId: String)
    // Tell the mod's `run`th run what extends its extension point `name` now, by the id of the mod that extends it.
    case extensionsChanged(modId: String, run: Int, name: String, extensions: [String: Snapshot])
    // The scoped names of the points the mod extends now.
    case extendsChanged(modId: String, points: [String])
    // What a layer on deck tells has changed of its own.
    case layer(any LayerChange)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
