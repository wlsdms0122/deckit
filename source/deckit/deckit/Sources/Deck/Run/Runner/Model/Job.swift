//
//  Job.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// What to run for a mod, handed whole by the caller. Its runs reach only what it names: a mod by id, the owner of an
// interface it uses at the major it uses.
public struct Job: Equatable, Sendable {
    // MARK: - Property
    public let modId: String
    // Two jobs of one revision run the same code, in one sandbox.
    public let revision: String
    // The file its page loads.
    public let entry: URL
    // The ids of the permissions granted to it.
    public let permissions: [String]
    // The ids of the mods it may reach by id.
    public let reaches: [String]
    // Interface -> the major of it it uses.
    public let uses: [String: Int]
    // Interface -> the majors of it it provides.
    public let provides: [String: [Int]]

    // MARK: - Initializer
    public init(
        modId: String,
        revision: String,
        entry: URL,
        permissions: [String],
        reaches: [String],
        uses: [String: Int],
        provides: [String: [Int]]
    ) {
        self.modId = modId
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
