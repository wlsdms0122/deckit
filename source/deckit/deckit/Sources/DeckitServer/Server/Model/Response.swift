//
//  Response.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// A JSON-RPC response: a result, or an error. An error with no id answers a message that could not be read.
enum Response: Equatable {
    case result(id: Int, JSONValue)
    case error(id: Int?, ResponseError)
}
