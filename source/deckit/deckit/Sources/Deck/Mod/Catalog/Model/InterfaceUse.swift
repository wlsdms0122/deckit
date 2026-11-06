//
//  InterfaceUse.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// An interface a mod names in its `uses`, at the major it uses, with the interface's owner, and what is wrong with it,
// or nil: an owner that does not provide that major or is not found, so the mod reaches no one by it. The mod itself
// as the owner is as if there were none.
public struct InterfaceUse: Equatable, Sendable {
    // MARK: - Property
    public let interface: String
    public let major: Int
    // The id and the name of its owner, or nil while it has none, the name nil too while the owner is not found.
    public let owner: String?
    public let name: String?
    public let problem: String?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
