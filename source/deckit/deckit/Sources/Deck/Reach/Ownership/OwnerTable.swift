//
//  OwnerTable.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// The owner of each interface, kept in `deck.json` and fed by the jobs of the mods that provide now, whether they run
// or not. The connections and the signals follow it as it was last provided or pinned.
public final class OwnerTable {
    // MARK: - Property
    private let store: OwnershipStore
    public private(set) var ownership: Ownership
    // The jobs last provided, which a pin is checked against.
    private var providers: [Job] = []

    // MARK: - Initializer
    init(store: OwnershipStore) {
        self.store = store
        self.ownership = store.read()
    }

    // MARK: - Public
    // The table as the `jobs` provide now, in the order they join a queue at once, the mods in `kept` keeping the places
    // they hold, written again when that changed it.
    @discardableResult
    public func provide(_ jobs: [Job], keeping kept: Set<String>) -> Ownership {
        let written = store.read()
        let joined = written.joined(by: jobs, keeping: kept)
        if joined != written {
            try? store.write(joined)
        }
        ownership = joined
        providers = jobs

        return joined
    }

    // As the person's: `id` owns `interface` from now on, whichever provider is first in its queue, until its pin is
    // cleared, for nil, or the mod leaves the queue. Refused for a mod that did not provide it as the jobs were last
    // provided.
    public func pin(_ interface: String, to id: String?) throws {
        let pinned = try store.read().pinned(interface, to: id, among: providers)
        try store.write(pinned)
        ownership = pinned
    }

    func owner(of interface: String) -> String? {
        ownership.owner(of: interface)
    }

    // MARK: - Private
}
