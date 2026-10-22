//
//  UnloadParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/22/26.
//

import Foundation
import Deck

struct UnloadParams: Decodable {
    // MARK: - Property
    let mods: [String]
    let reason: TerminateReason

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
