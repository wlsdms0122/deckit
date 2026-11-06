//
//  InterfaceUse+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck
import Deckit

extension InterfaceUse: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case interface
        case major
        case owner
        case name
        case problem
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(interface, forKey: .interface)
        try container.encode(major, forKey: .major)
        try container.encodeIfPresent(owner, forKey: .owner)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(problem, forKey: .problem)
    }

    // MARK: - Private
}
