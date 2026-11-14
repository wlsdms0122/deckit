//
//  KeyParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deck

// A key of a principal: the key base64.
struct KeyParams: Decodable {
    // MARK: - Property
    let principal: String
    let scheme: SignatureScheme
    let key: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
