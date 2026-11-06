//
//  StartupError.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// Why a mod's run from the app's start is not approved.
public enum StartupError: Refusal, Equatable {
    // A mod whose manifest does not ask to run from the start, by its id.
    case notAsked(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notAsked(mod):
            "\(mod) does not ask to run from the start"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
