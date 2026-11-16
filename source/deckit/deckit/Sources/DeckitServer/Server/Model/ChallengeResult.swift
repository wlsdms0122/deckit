//
//  ChallengeResult.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// What a claimant is to sign, base64, and the schemes it may sign by.
struct ChallengeResult: Encodable {
    // MARK: - Property
    let challenge: String
    let schemes: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
