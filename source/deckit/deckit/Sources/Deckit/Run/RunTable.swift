//
//  RunTable.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// What deckit keeps of each mod's latest run beside what deck keeps of it.
public final class RunTable {
    // MARK: - Property
    // Mod id -> the entry of its latest run.
    private var entries: [String: RunEntry] = [:]
    // Mod id -> the entry of the run before its latest: what is told of a run as the next one begins is still its own.
    private var previous: [String: RunEntry] = [:]

    // MARK: - Initializer
    init() {}

    // MARK: - Public
    // The entry of `run`, while it is its mod's latest or the one before.
    public func entry(of run: Run) -> RunEntry? {
        [entries[run.modId], previous[run.modId]].compactMap { entry in entry }.first { entry in
            entry.number == run.number
        }
    }

    func begin(_ run: Run) {
        previous[run.modId] = entries[run.modId]
        entries[run.modId] = RunEntry(number: run.number)
    }

    func timeOut(_ run: Run) {
        update(run) { entry in entry.timedOut = true }
    }

    // MARK: - Private
    // The entry of `run`, while it is its mod's latest.
    private func update(_ run: Run, _ change: (inout RunEntry) -> Void) {
        guard var entry = entries[run.modId], entry.number == run.number else { return }
        change(&entry)
        entries[run.modId] = entry
    }
}
