//
//  RunState.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Where a run is: it launches as it is made and ends not running.
enum RunState: String, Encodable, Sendable {
    case launching
    case running
    case terminating
    case notRunning

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
