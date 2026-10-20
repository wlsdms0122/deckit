//
//  CallError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a call is refused with: `kind` is how whoever asked tells one refusal from another.
public protocol CallError: Error {
    var kind: String { get }
    var message: String { get }
}
