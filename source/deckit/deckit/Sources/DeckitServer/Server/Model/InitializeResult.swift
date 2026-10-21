//
//  InitializeResult.swift
//  DeckitServer
//
//  Created by JSilver on 10/21/26.
//

import Foundation

// Where in deckit's folder deck keeps the mods it installed and the mods' data folders, one a mod named by its id.
struct InitializeResult: Encodable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mods
        case data
    }

    let mods: URL
    let data: URL

    // MARK: - Initializer
    // MARK: - Public
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(written(mods), forKey: .mods)
        try container.encode(written(data), forKey: .data)
    }

    // MARK: - Private
    // A folder as the wire writes every path, with no slash at its end.
    private func written(_ folder: URL) -> String {
        let path = folder.path(percentEncoded: false)
        return path.hasSuffix("/") ? String(path.dropLast()) : path
    }
}
