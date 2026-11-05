//
//  LoadParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// The mods requested to run, each with why.
struct LoadParams: Decodable {
    // MARK: - Property
    let requests: [LaunchRequest]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
