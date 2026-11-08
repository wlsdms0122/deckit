//
//  PrincipalState.swift
//  Deck
//
//  Created by JSilver on 10/27/26.
//

import Foundation

// What a layer on deck keeps for each principal, under a name it reserves: JSON text, one file a principal, a folder a
// name. Deck keeps the text it is handed, never reads what it says, and erases it with the principal.
public final class PrincipalState {
    // MARK: - Property
    private let fileExtension = "json"
    private let root: URL
    private let store: Store
    private var names: [String] = []

    // MARK: - Initializer
    init(root: URL, store: Store) {
        self.root = root
        self.store = store
    }

    // MARK: - Public
    // `name` is the caller's to keep its own under, and no other's.
    package func reserve(_ name: String) throws(PrincipalStateError) {
        guard store.isName(name) else { throw .notAName(name) }
        guard !names.contains(name) else { throw .reserved(name) }

        names.append(name)
    }

    package func read(_ name: String, principal: String) -> String? {
        store.read(file(name, principal: principal))
    }

    package func write(_ name: String, principal: String, text: String) throws {
        try store.write(text, to: file(name, principal: principal))
    }

    // The names the principal has anything kept under, in the order they were reserved.
    func kept(principal: String) -> [String] {
        names.filter { name in store.exists(file(name, principal: principal)) }
    }

    func erase(principal: String) throws {
        for name in names {
            try store.remove(file(name, principal: principal))
        }
    }

    // MARK: - Private
    // The caller hands a principal that is a name, so it is a file name.
    private func file(_ name: String, principal: String) -> URL {
        root.appending(path: name, directoryHint: .isDirectory)
            .appending(path: principal)
            .appendingPathExtension(fileExtension)
    }
}
