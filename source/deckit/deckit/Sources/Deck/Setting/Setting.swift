//
//  Setting.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod's settings as saved: a value by key, one file a mod, kept apart from the mod's own data folder.
final class Setting {
    // MARK: - Property
    private let fileExtension = "json"
    private let folder: URL
    private let store: Store

    // MARK: - Initializer
    init(folder: URL, store: Store) {
        self.folder = folder
        self.store = store
    }

    // MARK: - Public
    // A file that is not there, or that is not a table of values, reads as none saved.
    func read(mod: String) -> [String: SettingValue] {
        guard let text = store.read(file(of: mod)) else { return [:] }
        return (try? JSONDecoder().decode([String: SettingValue].self, from: Data(text.utf8))) ?? [:]
    }

    // One value saved among the others the mod has: whether it changed.
    func write(mod: String, key: String, value: SettingValue) throws -> Bool {
        var values = read(mod: mod)
        guard values[key] != value else { return false }

        values[key] = value
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        try store.write(String(decoding: try encoder.encode(values), as: UTF8.self), to: file(of: mod))

        return true
    }

    func erase(mod: String) throws {
        try store.remove(file(of: mod))
    }

    // MARK: - Private
    // Mod ids are held to their rule before a mod loads, so an id here is a file name.
    private func file(of mod: String) -> URL {
        folder.appending(path: mod).appendingPathExtension(fileExtension)
    }
}
