//
//  InterfaceQueue.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// An interface a mod provides or uses, with its owner and the mods that provide it, the earliest first.
public struct InterfaceQueue: Equatable, Sendable {
    // MARK: - Property
    // `<mod id>/<name>`.
    public let interface: String
    // The name of the mod whose id it starts with, the one that defines it, or nil while no mod of that id is found.
    public let name: String?
    // The id of its owner, or nil while no mod provides it.
    public let owner: String?
    // Whether the person pinned its owner.
    public let pinned: Bool
    public let providers: [InterfaceProvider]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
