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
    // `<id> <client mod>#<run>@<lifecycle> -> <service mod>#<run>@<lifecycle>`.
    var line: String {
        let end = { (endpoint: Endpoint) in "\(endpoint.modId)#\(endpoint.run)@\(endpoint.lifecycle)" }
        return "\(id) \(end(client)) -> \(end(service))"
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
