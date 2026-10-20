//
//  InstallError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Why a mod is not installed, or not removed.
enum InstallError: CallError, Equatable {
    // A mod deck would not load, and why.
    case notLoadable(String)
    case installedThere
    case nested
    case occupied(id: String, folder: String)
    // Why whoever installs it refuses it.
    case refused(String)
    case notInstalled(String)
    // A mod read in place, from where it is read.
    case readInPlace(id: String, folder: String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .notLoadable:
            "NOT_LOADABLE"

        case .installedThere:
            "INSTALLED_THERE"

        case .nested:
            "NESTED"

        case .occupied:
            "OCCUPIED"

        case .refused:
            "REFUSED"

        case .notInstalled:
            "NOT_INSTALLED"

        case .readInPlace:
            "READ_IN_PLACE"
        }
    }

    var message: String {
        switch self {
        case let .notLoadable(problem):
            problem

        case .installedThere:
            "that folder is already the installed one"

        case .nested:
            "that folder is inside the installed one, or holds it"

        case let .occupied(id, folder):
            "\(folder), where \(id) would be installed, holds another folder"

        case let .refused(reason):
            reason

        case let .notInstalled(id):
            "no installed mod \(id)"

        case let .readInPlace(id, folder):
            "\(id) is read from \(folder), not installed, so it is removed there"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
