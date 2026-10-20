//
//  HandlerList.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A scheme's handlers in the order they are asked, `system` what deckit opens its addresses with after them.
public struct HandlerList: Sendable {
    // MARK: - Property
    public let scheme: String
    public let system: SystemHandler?
    public let handlers: [SchemeHandler]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
