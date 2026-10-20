//
//  Record.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod's records: JSON text by key, one file a key, kept apart from the mod's own data folder. Deck never reads what
// a record says.
final class Record {
    // MARK: - Property
    private static let fileExtension = "json"

    // A key names a file, and a Mac's disk is blind to case: lower case only, as a mod id is.
    private let keyPattern = #/[a-z0-9][a-z0-9._-]{0,63}/#
    private let folder: URL
    private let store = Store()

    // MARK: - Initializer
    init(folder: URL) {
        self.folder = folder
    }

    // MARK: - Public
    func read(mod: String, key: String) throws -> String? {
        store.read(try file(mod: mod, key: key))
    }

    func write(mod: String, key: String, text: String) throws {
        try store.write(text, to: try file(mod: mod, key: key))
    }

    func remove(mod: String, key: String) throws {
        try store.remove(try file(mod: mod, key: key))
    }

    func keys(mod: String) throws -> [String] {
        let folder = folder(of: mod)
        guard FileManager.default.fileExists(atPath: folder.path(percentEncoded: false)) else { return [] }

        return try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false))
            .compactMap { name in
                let file = URL(filePath: name)
                guard file.pathExtension == Self.fileExtension else { return nil }

                let key = file.deletingPathExtension().lastPathComponent
                return isKey(key) ? key : nil
            }
            .sorted()
    }

    // Every record of the mod's.
    func erase(mod: String) throws {
        try store.remove(folder(of: mod))
    }

    // MARK: - Private
    // Mod ids are held to their rule before a mod loads, so an id here is a folder name.
    private func folder(of mod: String) -> URL {
        folder.appending(path: mod, directoryHint: .isDirectory)
    }

    private func file(mod: String, key: String) throws -> URL {
        guard isKey(key) else { throw CallError(kind: "KEY", message: "not a record key: \(key)") }
        return folder(of: mod).appending(path: key).appendingPathExtension(Self.fileExtension)
    }

    private func isKey(_ key: String) -> Bool {
        key.wholeMatch(of: keyPattern) != nil && !key.contains("..")
    }
}
