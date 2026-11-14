//
//  AdmissionAnswer.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deck
import Deckit

// An admission as the driver reads it: `{ effects, seat }` for a user that sits, or `{ asking: { user } }` for one
// that waits for the local seat's answer.
struct AdmissionAnswer {
    // MARK: - Property
    let effects: [EffectAnswer]?
    let seat: Seat?
    let asking: User?

    // MARK: - Initializer
    init(_ admission: Admission, of deckit: Deckit) {
        switch admission {
        case let .seated(seat, effects):
            self.effects = effects.map { effect in EffectAnswer(effect, of: deckit) }
            self.seat = seat
            asking = nil

        case let .asking(user):
            effects = nil
            seat = nil
            asking = user
        }
    }

    // MARK: - Public
    // MARK: - Private
}
