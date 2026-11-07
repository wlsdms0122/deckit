//
//  DeckSettings.swift
//  Deck
//
//  Created by JSilver on 11/4/26.
//

import Foundation

// `deck.json`, deck's settings file: a JSON object of what deck keeps for the person, each under its key. What else the
// file holds is kept as it is, and a file that does not read as a JSON object is not written.
package struct DeckSettings {
    // MARK: - Property
    private let file: URL
    private let store: Store

    // MARK: - Initializer
    package init(file: URL, store: Store) {
        self.file = file
        self.store = store
    }

    // MARK: - Public
    // What the file keeps under `key`, or nil while it keeps nothing there or does not read.
    package func value(of key: String) -> JSONValue? {
        (try? settings())?[JSONName(key)]
    }

    // Each value under its key, in one write.
    package func write(_ values: [String: JSONValue]) throws {
        let written = Dictionary(uniqueKeysWithValues: values.map { key, value in (JSONName(key), value) })
        let settings = try settings().merging(written) { _, value in value }
        let writer = JSONWriter(pretty: true, escapesSlashes: false)
        try store.write(String(decoding: try writer.write(JSONValue.object(settings)), as: UTF8.self), to: file)
    }

    // MARK: - Private
    // None while there is no file yet.
    private func settings() throws -> [JSONName: JSONValue] {
        guard let text = store.read(file) else { return [:] }
        guard case let .object(settings)? = try? JSONParser().parse(text) else {
            throw DeckSettingsError.unreadable(file.lastPathComponent)
        }

        return settings
    }
}
