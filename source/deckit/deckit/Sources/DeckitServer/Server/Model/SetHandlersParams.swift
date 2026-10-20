//
//  SetHandlersParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct SetHandlersParams: Decodable {
    // MARK: - Property
    let scheme: String
    // The handlers placed, in the order they take among themselves.
    let order: [String]
    let off: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
