//
//  Dependency.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// An interface a mod names in its [dependencies], at the lowest version it takes: a required one it runs only with, an
// optional one that comes and goes as it runs.
public struct Dependency: Equatable, Sendable {
    // MARK: - Property
    public let version: String
    public let optional: Bool

    // MARK: - Initializer
    // MARK: - Public
    // Whether an implementation at `implemented`, the version its manifest implements the interface at, is one it
    // takes.
    func isSatisfied(by implemented: String?) -> Bool {
        guard let wanted = Version(version), let found = implemented.flatMap(Version.init) else { return false }
        return found.satisfies(wanted)
    }

    // MARK: - Private
}
