//
//  Run.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One run of a mod's entry, the `number`th, launching as it is made, for the request of `origin`.
public struct Run: Sendable {
    // MARK: - Property
    public let modId: String
    public let number: Int
    public let origin: LaunchOrigin
    public private(set) var state: RunState = .launching
    // Whether it ended failing: it did not start, or it crashed before its end was asked, not ended with a mod it
    // requires.
    public private(set) var failed = false
    // Whether its mod reached the relaunch limit as it failed.
    public private(set) var relaunchLimited = false
    // The first problem recorded against it while it launches or runs, or why it failed or crashed.
    public private(set) var problem: String?
    // The id of the mod it requires whose end ended it, or nil when it ended otherwise or has not ended.
    public private(set) var endedWith: String?
    // What its page reported: `summary`, what the layers read of its entry and what it contributes, as a person reads
    // it, carried and not read; and once it launched, what it contributes now.
    public private(set) var summary: JSONValue?
    public private(set) var contributions: Contribution?

    // MARK: - Initializer
    init(modId: String, number: Int, origin: LaunchOrigin) {
        self.modId = modId
        self.number = number
        self.origin = origin
    }

    // MARK: - Public
    mutating func describe(_ summary: JSONValue) {
        self.summary = summary
    }

    // What it contributes now replaces what it did, once it launched.
    mutating func join(summary: JSONValue, contributions: Contribution) {
        guard self.contributions != nil else { return }
        self.summary = summary
        self.contributions = contributions
    }

    mutating func didLaunch(
        summary: JSONValue,
        contributions: Contribution
    ) throws(LifecycleError) -> LifecycleNotification {
        let notification = try move(.didLaunch)
        self.summary = summary
        self.contributions = contributions
        return notification
    }

    mutating func didFailToLaunch(_ problem: String) throws(LifecycleError) -> LifecycleNotification {
        let notification = try move(.didFailToLaunch)
        self.problem = self.problem ?? problem
        failed = true
        return notification
    }

    // Answers nil unless it launches or runs. `required` is the id of the mod it requires whose end ends it.
    mutating func terminate(with required: String? = nil) throws(LifecycleError) -> LifecycleNotification? {
        guard Transition.terminate.from.contains(state) else { return nil }

        endedWith = required
        return try move(.terminate)
    }

    mutating func didTerminate() throws(LifecycleError) -> LifecycleNotification {
        try move(.didTerminate)
    }

    // `required` is the id of the mod it requires whose end ended it: a run ended so did not fail by itself.
    mutating func crash(
        _ problem: String,
        with required: String? = nil
    ) throws(LifecycleError) -> LifecycleNotification {
        let asked = state == .terminating
        let notification = try move(.crash)
        self.problem = self.problem ?? problem
        endedWith = endedWith ?? required
        failed = failed || (!asked && required == nil)
        return notification
    }

    mutating func limitRelaunch() {
        relaunchLimited = true
    }

    // Whether the problem is recorded: a run keeps its first.
    mutating func record(_ problem: String) -> Bool {
        guard state == .launching || state == .running, self.problem == nil else { return false }
        self.problem = problem
        return true
    }

    // MARK: - Private
    private mutating func move(_ transition: Transition) throws(LifecycleError) -> LifecycleNotification {
        guard transition.from.contains(state) else {
            throw .transition(modId: modId, number: number, transition: transition, state: state)
        }
        state = transition.to

        return transition.tells
    }
}
