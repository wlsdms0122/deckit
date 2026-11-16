//
//  SeatError.swift
//  Deckit
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deck

public enum SeatError: Refusal, Equatable {
    // The local seat was asked and did not let the user sit.
    case refused
    // No admission of the transport connection waits for an answer.
    case notAsking(String)
    // The local seat is open already.
    case localOpen
    // What is no idle time: one below 0.
    case notATime(TimeInterval)

    // MARK: - Property
    public var message: String {
        switch self {
        case .refused:
            "the local seat did not admit it"

        case let .notAsking(transport):
            "no admission of \(transport) waits for an answer"

        case .localOpen:
            "the local seat is open already"

        case let .notATime(seconds):
            "not an idle time: \(seconds)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
