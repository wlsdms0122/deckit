//
//  TerminateReason.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Why a run terminates: the reason whoever unloads the mod gives, or `requirement`, deck's own.
public enum TerminateReason: String, Codable, Sendable {
    case relaunch
    // A mod it requires ended.
    case requirement
    case updated
    case removed
    case quit

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
