//
//  ResponseError+Refusal.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// A refusal as the driver reads it: its message, and its kind, which the driver puts back on the error it throws.
extension ResponseError {
    // MARK: - Property
    // MARK: - Initializer
    init(refusing error: any Refusal) {
        self.init(code: .requestFailed, message: error.message, kind: error.kind)
    }

    // MARK: - Public
    // MARK: - Private
}
