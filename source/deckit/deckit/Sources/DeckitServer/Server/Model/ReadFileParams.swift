//
//  ReadFileParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// A file inside a mod's folder, by its path there.
struct ReadFileParams: Decodable {
    // MARK: - Property
    let mod: String
    let path: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
