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
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
