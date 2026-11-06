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
struct EffectAnswer {
    // MARK: - Property
    let effect: Effect
    let found: Mod?
    let entry: RunEntry?

    // MARK: - Initializer
    init(_ effect: Effect, of deckit: Deckit) {
        self.effect = effect
        switch effect {
        case let .open(job):
            found = deckit.catalog.loading.first { mod in mod.manifest.id == job.modId }
            entry = nil

        case let .tell(_, run), let .keep(run):
            found = nil
            entry = deckit.runs.entry(of: run)

        default:
            found = nil
            entry = nil
        }
    }

    // MARK: - Public
    // MARK: - Private
}
