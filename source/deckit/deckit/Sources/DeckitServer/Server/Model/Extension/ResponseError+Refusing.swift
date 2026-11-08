//
//  ResponseError+Refusal.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// A refusal as the driver reads it: its message, its kind and its stage, which the driver puts back on the error it
// throws.
extension ResponseError {
    // MARK: - Property
    // MARK: - Initializer
    init(refusing error: any Refusal) {
        self.init(code: .requestFailed, message: error.message, kind: error.kind, stage: error.stage)
    }

    // MARK: - Public
    // MARK: - Private
}
