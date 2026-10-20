//
//  Version+Decodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// As it is written.
extension Version: Decodable {
    // MARK: - Property
    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        let written = try container.decode(String.self)
        guard let version = Version(written) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "not MAJOR.MINOR.PATCH: \(written)")
        }

        self = version
    }

    // MARK: - Public
    // MARK: - Private
}
