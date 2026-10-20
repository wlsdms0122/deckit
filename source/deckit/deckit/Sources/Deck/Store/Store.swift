//
//  Store.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Files deck keeps, each written whole.
struct Store {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    func read(_ file: URL) -> String? {
        guard let data = FileManager.default.contents(atPath: file.path(percentEncoded: false)) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    // Through a temporary file and a rename, so a crash mid-write leaves the previous version whole.
    func write(_ text: String, to file: URL) throws {
        try FileManager.default.createDirectory(
            at: file.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(text.utf8).write(to: file, options: .atomic)
    }

    func remove(_ file: URL) throws {
        guard FileManager.default.fileExists(atPath: file.path(percentEncoded: false)) else { return }
        try FileManager.default.removeItem(at: file)
    }

    // The names of what a folder holds, none for a folder that is not there.
    func names(in folder: URL) throws -> [String] {
        guard FileManager.default.fileExists(atPath: folder.path(percentEncoded: false)) else { return [] }
        return try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false))
    }

    // MARK: - Private
}
