//
//  Provision.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a mod gives the mods that depend on it: what it exports while it runs, pending while it launches or may launch
// again, or why it does not run.
enum Provision: Sendable {
    case ready(Snapshot)
    case pending(Pending)
    case ended(String)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
