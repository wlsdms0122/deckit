//
//  EffectAnswer.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck
import Deckit

// An effect as the driver reads it: deck's, with the mod a sandbox opens for as the catalog reads it and what deckit
// keeps of a run.
enum EffectAnswer {
    case effect(Effect, found: Mod?, entry: RunEntry?)

    // MARK: - Property
    // MARK: - Initializer
    init(_ effect: Effect, of deckit: Deckit) {
        switch effect {
        case let .open(job):
            let found = deckit.catalog.loading.first { mod in mod.manifest.id == job.modId }
            self = .effect(effect, found: found, entry: nil)

        case let .tell(_, run), let .keep(run):
            self = .effect(effect, found: nil, entry: deckit.runs.entry(of: run))

        default:
            self = .effect(effect, found: nil, entry: nil)
        }
    }

    // MARK: - Public
    // MARK: - Private
}
