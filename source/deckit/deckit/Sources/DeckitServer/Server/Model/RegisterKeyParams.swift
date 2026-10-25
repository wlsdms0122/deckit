//
//  RegisterKeyParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deckit

// A host's key, `owner` the name it declared the key's command under.
struct RegisterKeyParams: Decodable {
    // MARK: - Property
    let owner: String
    let key: Key

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
