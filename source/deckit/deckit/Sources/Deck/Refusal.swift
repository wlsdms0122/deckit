//
//  Refusal.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What deck, or a layer on it, refuses with, as a person reads it. Which refusal it is, is its case.
public protocol Refusal: Error {
    var message: String { get }
}
