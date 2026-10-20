//
//  Version.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A version written "MAJOR.MINOR.PATCH".
public struct Version: Equatable, Sendable {
    // MARK: - Property
    let major: Int
    let minor: Int
    let patch: Int

    // MARK: - Initializer
    // Nil for what is not written so.
    init?(_ written: String) {
        guard let match = written.wholeMatch(of: #/([0-9]+)\.([0-9]+)\.([0-9]+)/#),
            let major = Int(match.1),
            let minor = Int(match.2),
            let patch = Int(match.3)
        else { return nil }

        self.major = major
        self.minor = minor
        self.patch = patch
    }

    // MARK: - Public
    // The same major, and at least the wanted minor and patch.
    func satisfies(_ wanted: Version) -> Bool {
        major == wanted.major && (minor > wanted.minor || (minor == wanted.minor && patch >= wanted.patch))
    }

    // MARK: - Private
}
