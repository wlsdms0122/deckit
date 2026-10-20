//
//  TOMLValue.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A value as TOML writes it, of the kinds a manifest is written in. A table holds no order: TOML gives its keys none.
public enum TOMLValue: Equatable, Sendable {
    case string(String)
    case integer(Int)
    case boolean(Bool)
    case array([TOMLValue])
    case table([String: TOMLValue])

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
