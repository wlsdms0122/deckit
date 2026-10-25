//
//  RegisteredCommand+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deckit

// `{ mod, modName, host, command, label, description, keywords, params }`: `mod` is the owner's id, a mod's or a
// host's name, and `params` the schema as written, null for a command that takes no args.
extension RegisteredCommand: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case modName
        case host
        case command
        case label
        case description
        case keywords
        case params
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(owner.id, forKey: .mod)
        try container.encode(owner.name, forKey: .modName)
        try container.encode(owner.isHost, forKey: .host)
        try container.encode(command.name, forKey: .command)
        try container.encode(command.label, forKey: .label)
        try container.encode(command.description, forKey: .description)
        try container.encode(command.keywords, forKey: .keywords)
        try container.encode(command.params?.value, forKey: .params)
    }

    // MARK: - Private
}
