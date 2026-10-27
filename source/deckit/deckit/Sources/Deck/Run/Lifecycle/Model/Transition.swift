//
//  Transition.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A step of a run: the states it leaves, the state it reaches and what it tells. A launch that fails ends as any run
// does, its end asked of its page while it terminates. A crash ends a run that has not ended, with no willTerminate
// before it.
public enum Transition: String, Sendable {
    case didLaunch
    case didFailToLaunch
    case terminate
    case didTerminate
    case crash

    // MARK: - Property
    var from: Set<RunState> {
        switch self {
        case .didLaunch, .didFailToLaunch:
            [.launching]

        case .terminate:
            [.launching, .running]

        case .didTerminate:
            [.terminating]

        case .crash:
            [.launching, .running, .terminating]
        }
    }

    var to: RunState {
        switch self {
        case .didLaunch:
            .running

        case .didFailToLaunch, .terminate:
            .terminating

        case .didTerminate, .crash:
            .notRunning
        }
    }

    var tells: LifecycleNotification {
        switch self {
        case .didLaunch:
            .didLaunch

        case .didFailToLaunch:
            .didFailToLaunch

        case .terminate:
            .willTerminate

        case .didTerminate, .crash:
            .didTerminate
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
