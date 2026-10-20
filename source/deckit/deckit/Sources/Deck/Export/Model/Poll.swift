//
//  Poll.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What is asked, answered now, or pending on a run that has not decided it yet.
public enum Poll<Value: Sendable>: Sendable {
    case ready(Value)
    case pending(Pending)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
