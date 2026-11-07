//
//  JSONContent.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// What a JSONNode holds: an object by its members' names.
enum JSONContent {
    case empty
    case null
    case bool(Bool)
    case number(NSNumber)
    case string(String)
    case array([JSONNode])
    case object([JSONName: JSONNode])

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
