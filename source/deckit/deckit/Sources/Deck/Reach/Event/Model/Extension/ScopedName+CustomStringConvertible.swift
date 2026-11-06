//
//  ScopedName+CustomStringConvertible.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension ScopedName: CustomStringConvertible {
    // MARK: - Property
    var description: String {
        "\(modId):\(name)"
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
