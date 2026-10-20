//
//  URLRoute.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Where an address goes: offered to `handlers` in turn, the first to take it ending it, then opened by `system`, if
// deckit opens it by itself. `url` is the address as it is offered.
public struct URLRoute: Encodable, Sendable {
    // MARK: - Property
    let url: String
    let handlers: [String]
    let system: SystemHandler?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
