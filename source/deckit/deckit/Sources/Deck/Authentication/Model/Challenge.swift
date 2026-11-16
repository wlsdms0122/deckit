//
//  Challenge.swift
//  Deck
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// What one transport connection is to sign, once: the verifier's fresh bytes, the claimant's own, and the transport's
// channel binding, which ties a signature to the channel it was made for.
struct Challenge {
    // MARK: - Property
    let challenge: Data
    let nonce: Data
    let binding: Data

    // MARK: - Initializer
    // MARK: - Public
    // The bytes signed to authenticate as `principal`: the label keeps the signature from any other use of the key, and
    // a principal is a name, which holds no zero byte.
    func transcript(of principal: String) -> Data {
        Data("deckit-authenticate-1".utf8) + [0] + Data(principal.utf8) + [0] + challenge + nonce + binding
    }

    // MARK: - Private
}
