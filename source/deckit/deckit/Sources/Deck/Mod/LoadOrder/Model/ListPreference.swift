//
//  ListPreference.swift
//  Deck
//
//  Created by JSilver on 11/4/26.
//

import Foundation

// How the person arranged an interface's implementations: the mods placed, in order, and those switched off, by id.
struct ListPreference: Equatable, Sendable {
    // MARK: - Property
    static let none = ListPreference(order: [], off: [])

    let order: [String]
    let off: [String]

    // MARK: - Initializer
    // MARK: - Public
    // The ids placed in the interface's list, in order: the person's, then those of `host`, the host app's, they did
    // not place.
    func placed(host: [String]) -> [String] {
        order + host.filter { id in !order.contains(id) }
    }

    // MARK: - Private
}
