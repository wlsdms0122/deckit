//
//  StartedParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// A run that started, or that runs, with what it contributes as deck reads it. Other keys are not read.
struct StartedParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let contributions: Contribution

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
