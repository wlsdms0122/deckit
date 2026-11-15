//
//  SeatAnswerParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// What the user that waits on a transport connection is answered, whoever answered.
struct SeatAnswerParams: Decodable {
    // MARK: - Property
    let transport: String
    let allow: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
