//
//  InterfaceList.swift
//  Deck
//
//  Created by JSilver on 11/4/26.
//

import Foundation

// An interface's implementations in their order. It is `undecided` while two or more mods no one placed are on in it,
// and none placed is: they come by id until the person places one.
public struct InterfaceList: Equatable, Sendable {
    // MARK: - Property
    // `<mod id>/<name>`.
    public let interface: String
    // The name of the mod whose id it starts with, the one that defines it, or nil while no mod of that id is found.
    public let name: String?
    public let undecided: Bool
    public let implementations: [Implementation]
    // The first that is on: neither the version it implements nor whether it runs is looked at.
    public var pick: Implementation? {
        implementations.first { implementation in implementation.on }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
