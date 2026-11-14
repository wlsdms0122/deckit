//
//  Refusal+Stage.swift
//  DeckitServer
//
//  Created by JSilver on 11/8/26.
//

import Foundation
import Deck
import Deckit

extension Refusal {
    // MARK: - Property
    // The stage a request is refused at with it: "read" for a bundle the system does not take, "launch" for a run
    // that did not launch, and "call" for every other.
    var stage: String {
        switch self {
        case is ModFolderError:
            "read"

        case let error as LaunchError:
            switch error {
            case .relaunchLimit, .timedOut, .notLaunched:
                "launch"

            case .notPermitted, .notInstalled, .alreadyRunning:
                "call"
            }

        default:
            "call"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
