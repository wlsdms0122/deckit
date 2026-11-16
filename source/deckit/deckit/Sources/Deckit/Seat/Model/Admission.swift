//
//  Admission.swift
//  Deckit
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deck

// What admitting a user comes to: it sits at a seat, with what its run comes to as it launches, or the local seat is
// asked whether it may, and it waits for the answer.
public enum Admission {
    case seated(Seat, [Effect])
    case asking(User)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
