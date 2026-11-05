//
//  Dependency.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A mod another names in its [dependencies], at the version it wants: a required one it runs only with, an optional one
// that comes and goes as it runs.
public struct Dependency: Equatable, Sendable {
    // MARK: - Property
    public let version: String
    public let optional: Bool

    // MARK: - Initializer
    // MARK: - Public
    // Whether `provider` is at a version it takes.
    func isSatisfied(by provider: Manifest) -> Bool {
        guard let wanted = Version(version), let found = provider.version.flatMap(Version.init) else { return false }
        return found.satisfies(wanted)
    }

    // MARK: - Private
}
