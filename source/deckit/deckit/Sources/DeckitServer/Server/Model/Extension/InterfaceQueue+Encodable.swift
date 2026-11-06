//
//  InterfaceQueue+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck
import Deckit

extension InterfaceQueue: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case interface
        case name
        case owner
        case pinned
        case providers
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(interface, forKey: .interface)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(owner, forKey: .owner)
        try container.encode(pinned, forKey: .pinned)
        try container.encode(providers, forKey: .providers)
    }

    // MARK: - Private
}
