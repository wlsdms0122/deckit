//
//  LifecycleError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A run moved from a state its step does not leave.
public enum LifecycleError: DeckError, Equatable {
    case transition(modId: String, number: Int, transition: Transition, state: RunState)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .transition(modId, number, transition, state):
            "\(modId) run \(number): \(transition.rawValue) while \(state.rawValue)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
