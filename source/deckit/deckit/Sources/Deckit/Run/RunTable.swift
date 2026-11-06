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
    private let deck: Deck
    // Mod id -> the entry of its latest run.
    private var entries: [String: RunEntry] = [:]

    // MARK: - Initializer
    init(deck: Deck) {
        self.deck = deck
    }

    // MARK: - Public
    // The entry of `run`, while it is its mod's latest.
    public func entry(of run: Run) -> RunEntry? {
        guard let entry = entries[run.modId], entry.number == run.number else { return nil }
        return entry
    }

    // What the mod's latest run contributes for the layers, from its launch until it has ended.
    func contributions(of id: String) -> [String: JSONValue]? {
        guard let run = deck.run(of: id), run.state == .running || run.state == .terminating else { return nil }
        return entry(of: run)?.contributions
    }

    func begin(_ run: Run) {
        entries[run.modId] = RunEntry(number: run.number)
    }

    func describe(_ run: Run, summary: JSONValue) {
        update(run) { entry in entry.summary = summary }
    }

    func contribute(_ run: Run, summary: JSONValue, contributions: [String: JSONValue]) {
        update(run) { entry in
            entry.summary = summary
            entry.contributions = contributions
        }
    }

    func limitRelaunch(_ run: Run) {
        update(run) { entry in entry.relaunchLimited = true }
    }

    // MARK: - Private
    private func update(_ run: Run, _ change: (inout RunEntry) -> Void) {
        guard var entry = entry(of: run) else { return }
        change(&entry)
        entries[run.modId] = entry
    }
}
