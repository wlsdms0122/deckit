//
//  StartupList.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// The person's approvals of the mods that ask to run from the app's start, as they are kept: `startup` in
// `deck.json`, beside the order, mod id -> whether the person approves it. A mod with no entry is not decided.
final class StartupList {
    // MARK: - Property
    private let key = "startup"
    private let settings: DeckSettings

    // MARK: - Initializer
    init(file: URL, store: Store) {
        self.settings = DeckSettings(file: file, store: store)
    }

    // MARK: - Public
    // What is kept, or none of what the file does not keep as written here: it is a person's to edit.
    func read() -> [String: Bool] {
        guard case let .object(approvals)? = settings.value(of: key) else { return [:] }
        return approvals.compactMapValues { value in
            guard case let .bool(approved) = value else { return nil }
            return approved
        }
    }

    func write(_ approvals: [String: Bool]) throws {
        try settings.write([key: .object(approvals.mapValues(JSONValue.bool))])
    }

    // MARK: - Private
}
