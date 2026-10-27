//
//  DeclareConfigurationParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// What a run of a mod declares as its entry is read, in the order declared.
struct DeclareConfigurationParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let configuration: [JSONValue]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
