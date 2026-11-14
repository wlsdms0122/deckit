//
//  OwnershipStore.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// The ownership of the interfaces as it is kept: in `deck.json`, `providers`, interface -> the ids of the principals
// that provide it, the earliest first, and `pins`, interface -> the id of the provider pinned.
final class OwnershipStore {
    // MARK: - Property
    private let providersKey = "providers"
    private let pinsKey = "pins"
    private let settings: DeckSettings

    // MARK: - Initializer
    init(settings: DeckSettings) {
        self.settings = settings
    }

    // MARK: - Public
    // What is kept, or none of what the file does not keep as written here: it is a person's to edit.
    func read() -> Ownership {
        let queues: [String: [String]] = if case let .object(queues)? = settings.value(of: providersKey) {
            byText(queues).compactMapValues { value in
                guard case let .array(ids) = value else { return nil }
                return ids.compactMap { id in
                    guard case let .string(id) = id else { return nil }
                    return id
                }
            }
        } else {
            [:]
        }
        let pins: [String: String] = if case let .object(pins)? = settings.value(of: pinsKey) {
            byText(pins).compactMapValues { value in
                guard case let .string(id) = value else { return nil }
                return id
            }
        } else {
            [:]
        }

        return Ownership(queues: queues, pins: pins)
    }

    func write(_ ownership: Ownership) throws {
        try settings.write([
            providersKey: .object(byName(ownership.queues.mapValues { ids in .array(ids.map(JSONValue.string)) })),
            pinsKey: .object(byName(ownership.pins.mapValues(JSONValue.string)))
        ])
    }

    // MARK: - Private
    // An object by its names' text, which takes two names of one canonical form as one: of those, the name that comes
    // first is kept.
    private func byText(_ object: [JSONName: JSONValue]) -> [String: JSONValue] {
        let pairs = object.sorted { one, other in one.key < other.key }.map { name, value in (name.text, value) }
        return Dictionary(pairs) { first, _ in first }
    }

    private func byName(_ values: [String: JSONValue]) -> [JSONName: JSONValue] {
        Dictionary(uniqueKeysWithValues: values.map { key, value in (JSONName(key), value) })
    }
}
