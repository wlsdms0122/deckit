//
//  InterfaceChange.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// What deck tells of an interface, `<interface>:<signal>`, the signal its raw value: a name the interface's owner does
// not send.
enum InterfaceChange: String, Sendable {
    case owner = "owner-changed"
    case contributions = "contributions-changed"
}
