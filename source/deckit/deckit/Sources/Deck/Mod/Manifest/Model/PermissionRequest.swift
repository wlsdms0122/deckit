//
//  PermissionRequest.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A permission a manifest asks for, and why, as it says. One the contract names that no layer on this host gives is not
// `usable` here: the mod runs without what it guards.
public struct PermissionRequest: Equatable, Sendable {
    // MARK: - Property
    public let permission: Permission
    public let reason: String
    public let usable: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
