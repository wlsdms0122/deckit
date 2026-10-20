//
//  PermissionRequest.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A permission a manifest asks for, and why, as it says.
public struct PermissionRequest: Equatable, Sendable {
    // MARK: - Property
    public let permission: Permission
    let reason: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
