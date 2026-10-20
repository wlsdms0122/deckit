//
//  WriteStateParams.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct WriteStateParams: Decodable {
    // MARK: - Property
    let folder: String?
    let key: String
    // JSON, as the key's file holds it.
    let text: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
