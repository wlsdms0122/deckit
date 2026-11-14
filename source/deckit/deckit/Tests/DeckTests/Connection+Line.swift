//
//  Connection+Line.swift
//  DeckTests
//
//  Created by JSilver on 10/28/26.
//

import Foundation
@testable import Deck

extension Connection {
    // MARK: - Property
    // `<id> <client principal>#<run>@<lifecycle> -> <service principal>#<run>@<lifecycle>`.
    var line: String {
        let end = { (endpoint: Endpoint) in "\(endpoint.principal)#\(endpoint.run)@\(endpoint.lifecycle)" }
        return "\(id) \(end(client)) -> \(end(service))"
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
