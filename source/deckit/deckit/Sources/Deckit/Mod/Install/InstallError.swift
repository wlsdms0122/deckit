//
//  InstallError.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// Why a mod is not installed, or not removed.
public enum InstallError: Refusal, Equatable {
    case nested
    case notInstalled(String)
    // A mod read in place under the id, from where it is read.
    case readInPlace(id: String, folder: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case .nested:
            "that folder is inside deck's own folder, or holds it"

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
