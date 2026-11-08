//
//  Refusal+Kind.swift
//  DeckitServer
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Deck
import Deckit

extension Refusal {
    // MARK: - Property
    // The name the driver tells the refusal by, or nil for one it does not tell apart.
    var kind: String? {
        switch self {
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

            case .notUp:
                "NOT_UP"

            case .outOfReach:
                "REFUSED"
            }

        case let error as InstallError:
            switch error {
            case .nested:
                "NESTED"

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

        case let error as DeckSettingsError:
            switch error {
            case .unreadable:
                "UNREADABLE"
            }

        case let error as PinError:
            switch error {
            case .notProvider:
                "NOT_PROVIDER"
            }

        case let error as LaunchError:
            switch error {
            case .notPermitted:
                "NOT_PERMITTED"
            }

        case let error as DeclarationError:
            switch error {
            case .notOwner:
                "NOT_OWNER"
            }

        case let error as ModFolderError:
            switch error {
            case .notLoadable:
                "NOT_LOADABLE"
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

        default:
            nil
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
