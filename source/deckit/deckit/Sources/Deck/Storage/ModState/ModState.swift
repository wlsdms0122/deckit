//
//  ModState.swift
//  Deck
//
//  Created by JSilver on 10/27/26.
//

import Foundation

// What a layer on deck keeps for each mod, under a name it reserves: JSON text, one file a mod, a folder a name. Deck
// keeps the text it is handed, never reads what it says, and erases it with the mod.
public final class ModState {
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
    package func reserve(_ name: String) throws(ModStateError) {
        guard store.isName(name) else { throw .notAName(name) }
        guard !names.contains(name) else { throw .reserved(name) }

        names.append(name)
    }

    package func read(_ name: String, mod: String) -> String? {
        store.read(file(name, mod: mod))
    }

    package func write(_ name: String, mod: String, text: String) throws {
        try store.write(text, to: file(name, mod: mod))
    }

    // The names the mod has anything kept under, in the order they were reserved.
    func kept(mod: String) -> [String] {
        names.filter { name in store.exists(file(name, mod: mod)) }
    }

    func erase(mod: String) throws {
        for name in names {
            try store.remove(file(name, mod: mod))
        }
    }

    // MARK: - Private
    // Mod ids are held to their rule before a mod loads, so an id here is a file name.
    private func file(_ name: String, mod: String) -> URL {
        root.appending(path: name, directoryHint: .isDirectory)
            .appending(path: mod)
            .appendingPathExtension(fileExtension)
    }
}
