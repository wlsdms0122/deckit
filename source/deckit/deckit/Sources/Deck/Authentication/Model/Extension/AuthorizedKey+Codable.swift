//
//  AuthorizedKey+Codable.swift
//  Deck
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// `{ scheme, key, name }`, the key as base64 text: as its file keeps it, and as it is told.
extension AuthorizedKey: Codable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case scheme
        case key
        case name
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let scheme = try container.decode(String.self, forKey: .scheme)
        let text = try container.decode(String.self, forKey: .key)
        guard let scheme = SignatureScheme(rawValue: scheme) else {
            throw DecodingError.dataCorruptedError(forKey: .scheme, in: container, debugDescription: "no such scheme")
        }
        guard let key = Data(base64Encoded: text) else {
            throw DecodingError.dataCorruptedError(forKey: .key, in: container, debugDescription: "a key is base64")
        }

        self.init(scheme: scheme, key: key, name: try container.decode(String.self, forKey: .name))
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(scheme.rawValue, forKey: .scheme)
        try container.encode(key.base64EncodedString(), forKey: .key)
        try container.encode(name, forKey: .name)
    }

    // MARK: - Private
}
