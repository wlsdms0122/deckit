//
//  ResponseError+Refusal.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// A refusal as the driver reads it: its message, and its kind, which the driver puts back on the error it throws.
extension ResponseError {
    // MARK: - Property
    // MARK: - Initializer
    init(refusing error: any Refusal) {
        self.init(code: .requestFailed, message: error.message, kind: Self.kind(of: error))
    }

    // MARK: - Public
    // MARK: - Private
    private static func kind(of error: any Refusal) -> String? {
        switch error {
        case let error as ErasureError:
            switch error {
            case .notAMod:
                "MOD"
            }

        case let error as ConnectionError:
            switch error {
            case .notRunning:
                "NOT_RUNNING"

            case .ended:
                "ENDED_CONNECTION"

            case .notAnEnd:
                "NOT_AN_END"
            }

        case let error as InstallError:
            switch error {
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

        case let error as LifecycleError:
            switch error {
            case .transition:
                "TRANSITION"
            }

        case let error as LoadOrderError:
            switch error {
            case .requiredLater:
                "REQUIRED_LATER"

            case .unreadable:
                "UNREADABLE"
            }

        case let error as ManifestError:
            switch error {
            case .permissionDefined:
                "PERMISSION"

            case .fieldDefined:
                "FIELD"
            }

        case let error as ModStorageError:
            switch error {
            case .notAMod:
                "MOD"
            }

        case let error as RecordError:
            switch error {
            case .notAKey:
                "KEY"
            }

        case let error as ModStateError:
            switch error {
            case .notAName:
                "NAME"

            case .reserved:
                "RESERVED"
            }

        case let error as StateError:
            switch error {
            case .notAKey:
                "KEY"

            case .notAFolder:
                "FOLDER"

            case .reserved:
                "RESERVED"
            }

        case let error as KeymapError:
            switch error {
            case .noSuchBinding:
                "SHORTCUT"

            case .notAChord:
                "CHORD"

            case .cannotWork, .notAHost, .noLabel:
                "REFUSED"
            }

        case let error as CommandError:
            switch error {
            case .noSuchCommand:
                "COMMAND"

            case .arguments:
                "ARGUMENTS"

            case .notAName, .declaration, .schema, .defined:
                "REFUSED"
            }

        case let error as ConfigurationError:
            switch error {
            case .undeclared:
                "UNDECLARED"

            case .notOfType:
                "TYPE"

            case .notAChoice:
                "CHOICE"
            }

        case let error as URLRouterError:
            switch error {
            case .noHandlers:
                "SCHEME"
            }

        default:
            nil
        }
    }
}
