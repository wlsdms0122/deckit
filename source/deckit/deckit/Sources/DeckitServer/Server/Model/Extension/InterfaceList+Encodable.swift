//
//  InterfaceList+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/4/26.
//

import Foundation
import Deck

extension InterfaceList: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case interface
        case name
        case undecided
        case implementations
        case pick
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(interface, forKey: .interface)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encode(undecided, forKey: .undecided)
        try container.encode(implementations, forKey: .implementations)
        try container.encodeIfPresent(pick?.id, forKey: .pick)
    }

    // MARK: - Private
}
