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

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
