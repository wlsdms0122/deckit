//
//  LifecycleNotification.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a run tells as it moves, in the order a run that starts and stops tells them.
public enum LifecycleNotification: String, Encodable, Sendable {
    case willLaunch
    case didLaunch
    case didFailToLaunch
    case willTerminate
    case didTerminate

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
