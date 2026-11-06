//
//  InterfaceProvider.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// A mod in an interface's queue, with the majors of the interface it provides.
public struct InterfaceProvider: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    public let majors: [Int]
    // Whether the person can pin it: it loads and provides the interface now, not kept in the queue with a problem.
    public let pinnable: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
