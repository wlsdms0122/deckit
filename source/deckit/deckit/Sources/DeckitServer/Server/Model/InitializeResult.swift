//
//  InitializeResult.swift
//  DeckitServer
//
//  Created by JSilver on 10/21/26.
//

import Foundation
import Deckit

// Where in deckit's folder deck keeps the mods it installed and the mods' data folders, one a mod named by its id, how
// long a run is given, and when a seat is idle.
struct InitializeResult: Encodable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mods
        case data
        case timeout
        case seats
    }

    let mods: URL
    let data: URL
    let timeout: RunTimeout
    let seats: IdleRule

    // MARK: - Initializer
    // MARK: - Public
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(written(mods), forKey: .mods)
        try container.encode(written(data), forKey: .data)
        try container.encode(timeout, forKey: .timeout)
        try container.encode(seats, forKey: .seats)
    }

    // MARK: - Private
    // A folder as the wire writes every path, with no slash at its end.
    private func written(_ folder: URL) -> String {
        let path = folder.path(percentEncoded: false)
        return path.hasSuffix("/") ? String(path.dropLast()) : path
    }
}
