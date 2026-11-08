//
//  ResponseError+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

extension ResponseError: Encodable {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(code.rawValue, forKey: .code)
        try container.encode(message, forKey: .message)
        if kind != nil || stage != nil {
            var data = container.nestedContainer(keyedBy: DataKeys.self, forKey: .data)
            try data.encodeIfPresent(kind, forKey: .kind)
            try data.encodeIfPresent(stage, forKey: .stage)
        }
    }

    // MARK: - Private
    private enum CodingKeys: String, CodingKey {
        case code
        case message
        case data
    }

    private enum DataKeys: String, CodingKey {
        case kind
        case stage
    }
}
