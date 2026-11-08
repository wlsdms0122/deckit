//
//  Run.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One run of a principal's job, the `number`th, launching as it is made.
public struct Run: Sendable {
    // MARK: - Property
    public let principal: String
    public let number: Int
    public private(set) var state: RunState = .launching
    // Whether it ended failing: it did not start, or it crashed before its end was asked.
    public private(set) var failed = false
    // The first problem recorded against it while it launches or runs, or why it failed or crashed.
    public private(set) var problem: String?
    // Once it launched, what it contributes now.
    public private(set) var contributions: Contribution?

    // MARK: - Initializer
    init(principal: String, number: Int) {
        self.principal = principal
        self.number = number
    }

    // MARK: - Public
    // What it contributes now replaces what it did, once it launched.
    mutating func join(_ contributions: Contribution) {
        guard self.contributions != nil else { return }
        self.contributions = contributions
    }

    mutating func didLaunch(_ contributions: Contribution) throws(LifecycleError) -> LifecycleNotification {
        let notification = try move(.didLaunch)
        self.contributions = contributions
        return notification
    }

    mutating func didFailToLaunch(_ problem: String) throws(LifecycleError) -> LifecycleNotification {
        let notification = try move(.didFailToLaunch)
        self.problem = self.problem ?? problem
        failed = true
        return notification
    }

    // Answers nil unless it launches or runs.
    mutating func terminate() throws(LifecycleError) -> LifecycleNotification? {
        guard Transition.terminate.from.contains(state) else { return nil }

        return try move(.terminate)
    }

    mutating func didTerminate() throws(LifecycleError) -> LifecycleNotification {
        try move(.didTerminate)
    }

    mutating func crash(_ problem: String) throws(LifecycleError) -> LifecycleNotification {
        let asked = state == .terminating
        let notification = try move(.crash)
        self.problem = self.problem ?? problem
        failed = failed || !asked
        return notification
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
            throw .transition(principal: principal, number: number, transition: transition, state: state)
        }
        state = transition.to

        return transition.tells
    }
}
