//
//  CommandSource+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

extension CommandSource: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case commands
        case now
        case resolve
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(commands, forKey: .commands)
        try container.encode(now, forKey: .now)
        try container.encode(resolve, forKey: .resolve)
    }

    // MARK: - Private
}
