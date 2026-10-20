//
//  Record.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod's records: JSON by key, one file a key, kept apart from the mod's own data folder. Deck keeps the text it is
// handed and never reads what it says.
public final class Record {
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
    public func read(mod: String, key: String) throws -> String? {
        store.read(try file(mod: mod, key: key))
    }

    public func write(mod: String, key: String, text: String) throws {
        try store.write(text, to: try file(mod: mod, key: key))
    }

    public func remove(mod: String, key: String) throws {
        try store.remove(try file(mod: mod, key: key))
    }

    public func keys(mod: String) throws -> [String] {
        try store.names(in: folder(of: mod))
            .compactMap { name in
                let file = URL(filePath: name)
                guard file.pathExtension == fileExtension else { return nil }

                let key = file.deletingPathExtension().lastPathComponent
                return store.isName(key) ? key : nil
            }
            .sorted()
    }

    func erase(mod: String) throws {
        try store.remove(folder(of: mod))
    }

    // A mod that manages the mods asks for any id, so one that is no mod's is refused.
    public func count(mod: String) throws -> RecordCount {
        guard store.isName(mod) else { throw RecordError.notAMod(mod) }

        let names = try store.names(in: folder(of: mod))
        let hidden = names.filter { $0.hasPrefix(".") }
        return RecordCount(count: names.count - hidden.count, hidden: !hidden.isEmpty)
    }

    // MARK: - Private
    // Mod ids are held to their rule before a mod loads, so an id here is a folder name.
    private func folder(of mod: String) -> URL {
        folder.appending(path: mod, directoryHint: .isDirectory)
    }

    private func file(mod: String, key: String) throws -> URL {
        guard store.isName(key) else { throw RecordError.notAKey(key) }
        return folder(of: mod).appending(path: key).appendingPathExtension(fileExtension)
    }
}
