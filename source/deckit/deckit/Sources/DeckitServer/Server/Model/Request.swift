//
//  Request.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// A JSON-RPC request, or a notification when it has no id.
struct Request {
    // MARK: - Property
    let id: Int?
    let method: String
    // As the message writes them, each name of an object its own.
    let params: JSONValue?

    // MARK: - Initializer
    // The request `message` is: an object of an integer id, or none, a string method, and params, or none. Any other
    // message throws `DecodingError.typeMismatch`.
    init(_ message: JSONValue) throws {
        guard case let .object(members) = message else {
            throw Self.mismatch(JSONValue.self, at: [], "a request is a JSON object")
        }

        if case .null = members["id"] ?? .null {
            id = nil
        } else if case let .number(number)? = members["id"], let number = Int(exactly: number) {
            id = number
        } else {
            throw Self.mismatch(Int.self, at: ["id"], "an id is an integer")
        }

        guard case let .string(method)? = members["method"] else {
            throw Self.mismatch(String.self, at: ["method"], "a method is a string")
        }

        self.method = method
        params = members["params"]
    }

    // MARK: - Public
    // Its params as `type` takes them, none read as null.
    func decodeParams<Params: Decodable>(as type: Params.Type) throws -> Params {
        try (params ?? .null).decode(as: type)
    }

    // MARK: - Private
    private static func mismatch(_ type: Any.Type, at path: [JSONName], _ description: String) -> DecodingError {
        .typeMismatch(type, DecodingError.Context(codingPath: path, debugDescription: description))
    }
}
