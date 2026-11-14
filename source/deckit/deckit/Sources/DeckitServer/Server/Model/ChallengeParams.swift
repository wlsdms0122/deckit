//
//  ChallengeParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// A transport connection's claimant asks what to sign: its nonce and the transport's channel binding, each base64.
struct ChallengeParams: Decodable {
    // MARK: - Property
    let transport: String
    let nonce: String
    let binding: String?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
