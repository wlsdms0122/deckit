//
//  PermissionRequest.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A permission a manifest asks for by its id, and why, as it says, with what a layer on this host defines it as. One no
// layer on this host defines is not `usable` here: the mod runs without what it guards.
public struct PermissionRequest: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let reason: String
    public let permission: Permission?
    public var usable: Bool {
        permission != nil
    }
    public var reach: PermissionReach {
        PermissionReach(of: id)
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
