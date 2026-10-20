//
//  DeckError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What deck, or a layer on it, refuses with: `kind` is how whoever asked tells one refusal from another.
public protocol DeckError: Error {
    var kind: String { get }
    var message: String { get }
}
