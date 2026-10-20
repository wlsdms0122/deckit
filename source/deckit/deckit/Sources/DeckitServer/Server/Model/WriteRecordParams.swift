//
//  WriteRecordParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct WriteRecordParams: Decodable {
    // MARK: - Property
    let mod: String
    let key: String
    // JSON, as the record's file holds it.
    let text: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
