//
//  SeatAnswerParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// What the local seat answers the user that waits on a transport connection.
struct SeatAnswerParams: Decodable {
    // MARK: - Property
    let transport: String
    let allow: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
