//
//  DescribedParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/27/26.
//

import Foundation
import Deck

// A run that read its entry, with what the layers read of it, as a person reads it.
struct DescribedParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let summary: JSONValue

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
