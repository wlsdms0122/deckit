//
//  Manifest+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

extension Manifest: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case version
        case api
        case main
        case background
        case provides
        case uses
        case permissions
        case contributes
        case fields
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(version, forKey: .version)
        try container.encode(api, forKey: .api)
        try container.encode(main, forKey: .main)
        try container.encode(background, forKey: .background)
        try container.encode(provides, forKey: .provides)
        try container.encode(uses, forKey: .uses)
        try container.encode(permissions, forKey: .permissions)
        try container.encode(contributes, forKey: .contributes)
        try container.encode(JSONValue.object(fields), forKey: .fields)
    }

    // MARK: - Private
}
