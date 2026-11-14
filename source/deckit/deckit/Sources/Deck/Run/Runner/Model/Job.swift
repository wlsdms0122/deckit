//
//  Job.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// What to run for a principal, handed whole by the caller. Its runs reach only what it names: a principal by an id it
// may reach, as a lifecycle asks, the owner of an interface it uses at the major it uses.
public struct Job: Equatable, Sendable {
    // MARK: - Property
    public let principal: String
    // Two jobs of one revision run the same code, in one sandbox.
    public let revision: String
    // The file its page loads.
    public let entry: URL
    // The ids of the permissions granted to it.
    public let permissions: [String]
    // The principals it may reach by id.
    public let reaches: PrincipalSet
    // Interface -> the major of it it uses.
    public let uses: [String: Int]
    // Interface -> the majors of it it provides.
    public let provides: [String: [Int]]

    // MARK: - Initializer
    public init(
        principal: String,
        revision: String,
        entry: URL,
        permissions: [String],
        reaches: PrincipalSet,
        uses: [String: Int],
        provides: [String: [Int]]
    ) {
        self.principal = principal
        self.revision = revision
        self.entry = entry
        self.permissions = permissions
        self.reaches = reaches
        self.uses = uses
        self.provides = provides
    }

    // MARK: - Public
    // MARK: - Private
}
