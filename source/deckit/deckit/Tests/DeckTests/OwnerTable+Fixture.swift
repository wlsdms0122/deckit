//
//  OwnerTable+Fixture.swift
//  DeckTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
@testable import Deck

extension OwnerTable {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // An owner table kept in `deck.json` in a folder of its own, under `name`, with no interface provided yet.
    static func fixture(_ name: String) -> OwnerTable {
        let home = FileManager.default.temporaryDirectory.appending(path: "\(name)-\(UUID().uuidString)")
        let settings = DeckSettings(file: home.appending(path: "deck.json"), store: Store())

        return OwnerTable(store: OwnershipStore(settings: settings))
    }

    // MARK: - Private
}
