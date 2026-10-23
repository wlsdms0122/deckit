//
//  ScopedName+CustomStringConvertible.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

extension ScopedName: CustomStringConvertible {
    // MARK: - Property
    var description: String {
        "\(modId):\(name)"
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
