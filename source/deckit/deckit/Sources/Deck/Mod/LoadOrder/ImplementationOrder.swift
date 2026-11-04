//
//  ImplementationOrder.swift
//  Deck
//
//  Created by JSilver on 11/4/26.
//

import Foundation

// Each interface's order of implementations as the person keeps it: `implementations` in `deck.json`, beside the load
// order, interface -> `{ "order": [id], "off": [id] }`. An id stays while its mod is off the list, until the mod is
// removed.
final class ImplementationOrder {
    // MARK: - Property
    private let key = "implementations"
    private let settings: DeckSettings

    // MARK: - Initializer
    init(file: URL, store: Store) {
        self.settings = DeckSettings(file: file, store: store)
    }

    // MARK: - Public
    // What is kept, by interface, or none while the file keeps nothing of it: it is a person's to edit, so what is not
    // a list of ids reads as none.
    func read() -> [String: ImplementationPreference] {
        guard case let .object(kept)? = settings.value(of: key) else { return [:] }
        return kept.compactMapValues { value in
            guard case let .object(fields) = value else { return nil }
            return ImplementationPreference(order: ids(in: fields["order"]), off: ids(in: fields["off"]))
        }
    }

    func write(_ preferences: [String: ImplementationPreference]) throws {
        let value = JSONValue.object(preferences.mapValues { preference in
            .object([
                "order": .array(preference.order.map(JSONValue.string)),
                "off": .array(preference.off.map(JSONValue.string))
            ])
        })
        try settings.write(value, as: key)
    }

    // The mods named taken out of every interface's order. Nothing is written when none was kept.
    func remove(_ ids: [String]) throws {
        let before = read()
        let after = before.mapValues { preference in
            ImplementationPreference(
                order: preference.order.filter { id in !ids.contains(id) },
                off: preference.off.filter { id in !ids.contains(id) }
            )
        }
        guard after != before else { return }
        try write(after)
    }

    // MARK: - Private
    private func ids(in value: JSONValue?) -> [String] {
        guard case let .array(ids)? = value else { return [] }
        return ids.compactMap { id in
            guard case let .string(id) = id else { return nil }
            return id
        }
    }
}
