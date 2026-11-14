//
//  VerifyParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// A transport connection's claimant answers its challenge: the key and the signature each base64. `idle` is the
// seconds the local seat's devices gave no input for, as the driver measured it.
struct VerifyParams: Decodable {
    // MARK: - Property
    let transport: String
    let principal: String
    let scheme: String
    let key: String
    let signature: String
    let idle: TimeInterval

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
