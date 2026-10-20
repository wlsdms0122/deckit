//
//  RunProblemParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What went wrong with a run of a mod.
struct RunProblemParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let problem: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
