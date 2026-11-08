//
//  RelaunchLimit.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// How often a mod's runs may fail before a request launches it no more: a mod reaches the limit once `burst` of its
// runs failed within `interval` seconds, and stays at it until its limit is reset.
public struct RelaunchLimit: Sendable {
    // MARK: - Property
    let burst: Int
    let interval: TimeInterval
    // Mod id -> when its runs failed, the earliest first, those within `interval` of the latest.
    private var failures: [String: [Date]] = [:]
    private var reached: Set<String> = []

    // MARK: - Initializer
    public init(burst: Int, interval: TimeInterval) {
        self.burst = burst
        self.interval = interval
    }

    // MARK: - Public
    func isReached(by id: String) -> Bool {
        reached.contains(id)
    }

    // A run of the mod failed at `date`.
    mutating func fail(_ id: String, at date: Date) {
        let recent = (failures[id] ?? []).filter { failure in date.timeIntervalSince(failure) < interval } + [date]
        failures[id] = recent
        guard recent.count >= burst else { return }

        reached.insert(id)
    }

    // What the mod failed before is forgotten.
    mutating func reset(_ id: String) {
        failures[id] = nil
        reached.remove(id)
    }

    // MARK: - Private
}
