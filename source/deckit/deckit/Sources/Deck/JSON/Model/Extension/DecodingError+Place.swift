//
//  DecodingError+Place.swift
//  Deck
//
//  Created by JSilver on 10/21/26.
//

import Foundation

extension DecodingError {
    // MARK: - Property
    // Where in what was decoded what was not there, or not of its kind, is: `settings.2.label`, or nil for the whole.
    package var place: String? {
        let path = switch self {
        case let .keyNotFound(key, context):
            context.codingPath + [key]

        case let .typeMismatch(_, context), let .valueNotFound(_, context), let .dataCorrupted(context):
            context.codingPath

        @unknown default:
            [any CodingKey]()
        }
        guard !path.isEmpty else { return nil }

        return path.map { key in key.intValue.map(String.init) ?? key.stringValue }.joined(separator: ".")
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
