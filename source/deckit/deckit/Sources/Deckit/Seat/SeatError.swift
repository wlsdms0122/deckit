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

    // MARK: - Property
    public var message: String {
        switch self {
        case .refused:
            "the local seat did not admit it"

        case let .notAsking(transport):
            "no admission of \(transport) waits for an answer"

        case .localOpen:
            "the local seat is open already"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
