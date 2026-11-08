//
//  EffectAnswer.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck
import Deckit

// An effect as the driver reads it: deck's, with the mod a sandbox opens for as the catalog reads it and what a run is
// refused with at launch.
struct EffectAnswer {
    // MARK: - Property
    let effect: Effect
    let found: Mod?
    let refusal: LaunchError?

    // MARK: - Initializer
    init(_ effect: Effect, of deckit: Deckit) {
        self.effect = effect
        switch effect {
        case let .open(job):
            found = deckit.catalog.loading.first { mod in mod.manifest.id == job.modId }
            refusal = nil

        case let .tell(_, run), let .keep(run):
            found = nil
            refusal = deckit.refusal(of: run)

        default:
            found = nil
            refusal = nil
        }
    }

    // MARK: - Public
    // MARK: - Private
}
