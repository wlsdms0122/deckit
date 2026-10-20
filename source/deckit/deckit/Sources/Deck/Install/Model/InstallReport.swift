//
//  InstallReport.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod the app ships, what became of it as what it ships was installed, and the version installed or why not.
struct InstallReport: Encodable, Equatable, Sendable {
    // MARK: - Property
    let id: String
    let outcome: InstallOutcome
    let version: String?
    let problem: String?

    // MARK: - Initializer
    init(id: String, outcome: InstallOutcome, version: String? = nil, problem: String? = nil) {
        self.id = id
        self.outcome = outcome
        self.version = version
        self.problem = problem
    }

    // MARK: - Public
    // MARK: - Private
}
