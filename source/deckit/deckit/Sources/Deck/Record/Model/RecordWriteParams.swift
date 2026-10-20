//
//  RecordWriteParams.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct RecordWriteParams: Decodable {
    // MARK: - Property
    let mod: String
    let key: String
    // JSON text, as the record's file holds it.
    let value: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
