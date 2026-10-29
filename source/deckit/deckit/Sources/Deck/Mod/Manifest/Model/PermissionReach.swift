//
//  PermissionReach.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// How far what a permission grants reaches: past the app, or inside it.
public enum PermissionReach: String, CaseIterable, Codable, Sendable {
    case system
    case app

    // MARK: - Property
    // MARK: - Initializer
    // The id's prefix says it: `system.` past the app, any other inside it.
    init(of id: String) {
        self = id.hasPrefix("system.") ? .system : .app
    }

    // MARK: - Public
    // MARK: - Private
}
