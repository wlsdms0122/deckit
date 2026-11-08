//
//  PinError.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// Why a principal is not pinned as an interface's owner.
public enum PinError: Refusal, Equatable {
    // A principal that does not provide the interface.
    case notProvider(interface: String, principal: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notProvider(interface, principal):
            "\(principal) does not provide \(interface)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
