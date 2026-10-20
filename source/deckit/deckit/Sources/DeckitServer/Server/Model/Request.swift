//
//  Request.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// A JSON-RPC request, or a notification when it has no id.
struct Request: Decodable {
    // MARK: - Property
    let id: Int?
    let method: String
    let params: JSONValue?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
