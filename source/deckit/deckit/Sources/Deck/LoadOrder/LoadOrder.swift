//
//  LoadOrder.swift
//  Deck
//
//  Created by JSilver on 10/22/26.
//

import Foundation

// The order the mods load in as it is kept: `loadOrder` in `deck.json`, deck's settings file, a list of mod ids. What
// else the file holds is kept as it is.
final class LoadOrder {
    // MARK: - Property
    private let key = "loadOrder"
    private let file: URL
    private let store: Store

    // MARK: - Initializer
    init(file: URL, store: Store) {
        self.file = file
        self.store = store
    }

    // MARK: - Public
    // The ids kept, or none while the file keeps no list of them: it is a person's to edit.
    func read() -> [String] {
        guard case let .array(ids)? = settings()[key] else { return [] }
        return ids.compactMap { id in
            guard case let .string(id) = id else { return nil }
            return id
        }
    }

    func write(_ ids: [String]) throws {
        var settings = settings()
        settings[key] = .array(ids.map(JSONValue.string))
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        try store.write(String(decoding: try encoder.encode(JSONValue.object(settings)), as: UTF8.self), to: file)
    }

    // MARK: - Private
    private func settings() -> [String: JSONValue] {
        guard let text = store.read(file),
            case let .object(settings)? = try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
        else { return [:] }

        return settings
    }
}
