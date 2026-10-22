//
//  UnloadParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/22/26.
//

import Foundation
import Deck

// `requirement` is deck's own reason, never one the driver gives.
struct UnloadParams: Decodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mods
        case reason
    }

    let mods: [String]
    let reason: TerminateReason

    // MARK: - Initializer
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        mods = try container.decode([String].self, forKey: .mods)
        reason = try container.decode(TerminateReason.self, forKey: .reason)
        guard reason != .requirement else {
            throw DecodingError.dataCorruptedError(
                forKey: .reason,
                in: container,
                debugDescription: "requirement is deck's own reason"
            )
        }
    }

    // MARK: - Public
    // MARK: - Private
}
