//
//  EventDelivery.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// An event as its listeners hear it: its scoped name, and the mods whose runs listen to it.
public struct EventDelivery: Encodable, Equatable, Sendable {
    // MARK: - Property
    let name: String
    let listeners: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
