//
//  ApproveStartupParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation

struct ApproveStartupParams: Decodable {
    // MARK: - Property
    let mod: String
    // Whether the mod runs from the app's start from then on.
    let approved: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
