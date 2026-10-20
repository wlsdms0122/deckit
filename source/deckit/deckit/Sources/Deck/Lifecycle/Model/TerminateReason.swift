//
//  TerminateReason.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Why a run terminates, weakest first: a stronger reason given while it terminates takes the place of a weaker one.
public enum TerminateReason: String, Encodable, Sendable {
    case relaunch
    // A mod it requires ended: it launches again as that one does, or as it ends when that one already has.
    case requirement
    case updated
    case removed
    case quit

    // MARK: - Property
    // Whether the mod launches again once the run has ended.
    var relaunches: Bool {
        switch self {
        case .relaunch, .updated:
            true

        case .requirement, .removed, .quit:
            false
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    func isStronger(than other: TerminateReason) -> Bool {
        strength > other.strength
    }

    // MARK: - Private
    private var strength: Int {
        switch self {
        case .relaunch:
            0

        case .requirement:
            1

        case .updated:
            2

        case .removed:
            3

        case .quit:
            4
        }
    }
}
