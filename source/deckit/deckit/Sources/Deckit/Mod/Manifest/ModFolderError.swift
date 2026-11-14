//
//  ModFolderError.swift
//  Deckit
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Deck

// Why a folder is not a mod deckit takes, as it is read, before anything of the mod runs.
public enum ModFolderError: Refusal, Equatable {
    case notLoadable(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notLoadable(problem):
            problem
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
