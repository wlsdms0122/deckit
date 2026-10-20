//
//  RecordedKey+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

// As the page that records hears it: `{ pending: true }`, `{ error }`, `{ spec }`, `{ cancel: true }` or
// `{ clear: true }`.
extension RecordedKey: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case pending
        case error
        case spec
        case cancel
        case clear
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .pending:
            try container.encode(true, forKey: .pending)

        case let .refused(reason):
            try container.encode(reason, forKey: .error)

        case let .spec(spec):
            try container.encode(spec, forKey: .spec)

        case .cancel:
            try container.encode(true, forKey: .cancel)

        case .clear:
            try container.encode(true, forKey: .clear)
        }
    }

    // MARK: - Private
}
