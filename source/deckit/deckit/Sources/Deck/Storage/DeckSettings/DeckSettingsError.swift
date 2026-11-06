//
//  DeckSettingsError.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// Why deck's settings file is not written.
public enum DeckSettingsError: Refusal, Equatable {
    // The file, which does not read as a JSON object.
    case unreadable(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .unreadable(file):
            "\(file) does not read as a JSON object, so nothing is kept in it"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
