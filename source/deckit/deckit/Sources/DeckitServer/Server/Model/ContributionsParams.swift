//
//  ContributionsParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// An interface, and the mod that asks for what is declared to it as its owner.
struct ContributionsParams: Decodable {
    // MARK: - Property
    let mod: String
    let interface: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
