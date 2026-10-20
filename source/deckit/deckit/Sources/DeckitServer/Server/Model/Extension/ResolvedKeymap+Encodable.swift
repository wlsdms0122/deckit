//
//  ResolvedKeymap+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

extension ResolvedKeymap: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case revision
        case bindings
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(revision, forKey: .revision)
        try container.encode(bindings, forKey: .bindings)
    }

    // MARK: - Private
}
