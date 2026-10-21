//
//  InstallPlan.swift
//  Deck
//
//  Created by JSilver on 10/21/26.
//

import Foundation

// What installing a folder would do: the mod it installs, and whether that takes the place of a copy installed.
public struct InstallPlan: Sendable {
    // MARK: - Property
    public let manifest: Manifest
    public let replaces: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
