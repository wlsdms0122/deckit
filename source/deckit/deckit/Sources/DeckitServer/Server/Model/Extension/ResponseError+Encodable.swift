//
//  ResponseError+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

extension ResponseError: Encodable {
    // MARK: - Public
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(code.rawValue, forKey: .code)
        try container.encode(message, forKey: .message)
        if let kind {
            var data = container.nestedContainer(keyedBy: DataKeys.self, forKey: .data)
            try data.encode(kind, forKey: .kind)
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
    }
}
