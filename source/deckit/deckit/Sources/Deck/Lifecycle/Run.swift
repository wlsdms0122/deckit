//
//  Run.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One run of a mod's entry, the `number`th, launching as it is made.
public struct Run: Sendable {
    // MARK: - Property
    public let modId: String
    public let number: Int
    public private(set) var state: RunState = .launching
    // The first problem recorded against it while it launches or runs, or why it failed or crashed.
    public private(set) var problem: String?
    // The reason it terminated for: none for a run that crashed or did not launch.
    public private(set) var endReason: TerminateReason?
    // What its page reported as it started, once it launched: `summary`, what it contributes as a person reads it, is
    // carried and not read.
    public private(set) var summary: JSONValue?
    public private(set) var contributions: Contribution?

    public var relaunches: Bool {
        endReason?.relaunches ?? false
    }

    // MARK: - Initializer
    init(modId: String, number: Int) {
        self.modId = modId
        self.number = number
    }

    // MARK: - Public
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
        return notification
    }

    // Answers nil while it terminates already: a stronger reason then takes the place of the one it has, and any
    // reason that of a launch that failed.
    mutating func terminate(_ reason: TerminateReason) throws(LifecycleError) -> LifecycleNotification? {
        if state == .terminating {
            if endReason.map({ endReason in reason.isStronger(than: endReason) }) ?? true {
                self.endReason = reason
            }
            return nil
        }

        let notification = try move(.terminate)
        endReason = reason
        return notification
    }

    mutating func didTerminate() throws(LifecycleError) -> LifecycleNotification {
        try move(.didTerminate)
    }

    mutating func crash(_ problem: String) throws(LifecycleError) -> LifecycleNotification {
        let notification = try move(.crash)
        self.problem = self.problem ?? problem
        return notification
    }

    mutating func record(_ problem: String) {
        guard state == .launching || state == .running else { return }
        self.problem = self.problem ?? problem
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
