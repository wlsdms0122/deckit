//
//  TOMLError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a text is refused with, by the line it is on.
struct TOMLError: Error, Equatable {
    // MARK: - Property
    let line: Int
    let reason: String

    var message: String {
        "line \(line): \(reason)"
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
