//
//  EventError.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

public enum EventError: Refusal, Equatable {
    // A signal of an interface's owner named as deck or the driver tells of the interface.
    case reserved(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .reserved(name):
            "\(name) is told by deck or the driver: the owner of an interface sends no signal of that name"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
