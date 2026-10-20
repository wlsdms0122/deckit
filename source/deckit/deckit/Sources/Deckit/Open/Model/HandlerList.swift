//
//  HandlerList.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A scheme's handlers in the order they are asked, `system` what deckit opens its addresses with after them.
struct HandlerList: Encodable, Sendable {
    // MARK: - Property
    let scheme: String
    let system: SystemHandler?
    let handlers: [SchemeHandler]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
