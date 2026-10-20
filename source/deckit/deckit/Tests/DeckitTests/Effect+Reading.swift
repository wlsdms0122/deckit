//
//  Effect+Reading.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
@testable import Deck
@testable import Deckit

extension [Effect] {
    // MARK: - Property
    // The keymap the last `bindingsChanged` tells, or nil when none does.
    var bindingsChanged: ResolvedKeymap? {
        for case let .layer(keymap as ResolvedKeymap) in reversed() {
            return keymap
        }
        return nil
    }

    // The first problem a run is kept or told with.
    var problem: String? {
        for effect in self {
            switch effect {
            case let .keep(run), let .tell(_, run):
                if let problem = run.problem { return problem }

            default:
                continue
            }
        }
        return nil
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
