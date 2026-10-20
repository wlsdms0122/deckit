//
//  Response.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A JSON-RPC response: a result, or an error. An error with no id answers a message whose id could not be read.
enum Response {
    case result(id: Int, any Encodable & Sendable)
    case error(id: Int?, ResponseError)

    // MARK: - Property
    var id: Int? {
        switch self {
        case let .result(id, _):
            id

        case let .error(id, _):
            id
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
