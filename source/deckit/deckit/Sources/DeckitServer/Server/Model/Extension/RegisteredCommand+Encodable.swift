//
//  RegisteredCommand+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deckit

// `{ provider, command, description, params }`: `provider` is its id, a mod's or a host's name, and
// `params` the schema as written, null for a command that takes no args.
extension RegisteredCommand: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case provider
        case command
        case description
        case params
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(provider.id, forKey: .provider)
        try container.encode(command.name, forKey: .command)
        try container.encode(command.description, forKey: .description)
        try container.encode(command.params?.value, forKey: .params)
    }

    // MARK: - Private
}
