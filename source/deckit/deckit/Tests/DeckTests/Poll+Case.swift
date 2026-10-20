//
//  Poll+Case.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
@testable import Deck

extension Poll {
    // MARK: - Property
    var ready: Value? {
        guard case let .ready(value) = self else { return nil }
        return value
    }

    var pending: Pending? {
        guard case let .pending(pending) = self else { return nil }
        return pending
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
