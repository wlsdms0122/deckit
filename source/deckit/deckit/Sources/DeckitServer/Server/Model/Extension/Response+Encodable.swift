//
//  Response+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

extension Response: Encodable {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode("2.0", forKey: .jsonrpc)
        switch self {
        case let .result(id, result):
            try container.encode(id, forKey: .id)
            try container.encode(result, forKey: .result)

        case let .error(id, error):
            try container.encode(id, forKey: .id)
            try container.encode(error, forKey: .error)
        }
    }

    // MARK: - Private
    private enum CodingKeys: String, CodingKey {
        case jsonrpc
        case id
        case result
        case error
    }
}
