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
    // `<id> <dependent mod>#<run>@<lifecycle> -> <dependency mod>#<run>@<lifecycle>`, and ` required` for a required one.
    var line: String {
        let end = { (endpoint: Endpoint) in "\(endpoint.modId)#\(endpoint.run)@\(endpoint.lifecycle)" }
        return "\(id) \(end(dependent)) -> \(end(dependency))" + (required ? " required" : "")
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
