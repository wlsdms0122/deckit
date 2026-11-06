//
//  Version+CustomStringConvertible.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension Version: CustomStringConvertible {
    // MARK: - Property
    public var description: String {
        "\(major).\(minor).\(patch)"
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
