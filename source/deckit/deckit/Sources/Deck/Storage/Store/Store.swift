//
//  Store.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Files deck keeps, each written whole.
package struct Store {
    // MARK: - Property
    // A name deck gives a file or a folder. A Mac's disk is blind to case: lower case only, as a mod id is.
    private let namePattern = #/[a-z0-9][a-z0-9._-]{0,63}/#

    // MARK: - Initializer
    package init() {}

    // MARK: - Public
    package func isName(_ name: String) -> Bool {
        name.wholeMatch(of: namePattern) != nil && !name.contains("..")
    }

    package func read(_ file: URL) -> String? {
        guard let data = FileManager.default.contents(atPath: file.path(percentEncoded: false)) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    // Through a temporary file and a rename, so a crash mid-write leaves the previous version whole.
    package func write(_ text: String, to file: URL) throws {
        try FileManager.default.createDirectory(
            at: file.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(text.utf8).write(to: file, options: .atomic)
    }

    package func exists(_ file: URL) -> Bool {
        FileManager.default.fileExists(atPath: file.path(percentEncoded: false))
    }

    package func remove(_ file: URL) throws {
        guard exists(file) else { return }
        try FileManager.default.removeItem(at: file)
    }

    // The names of what a folder holds, none for a folder that is not there.
    package func names(in folder: URL) throws -> [String] {
        guard FileManager.default.fileExists(atPath: folder.path(percentEncoded: false)) else { return [] }
        return try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false))
    }

    package func isFolder(_ file: URL) -> Bool {
        var isDirectory: ObjCBool = false
        return FileManager.default.fileExists(atPath: file.path(percentEncoded: false), isDirectory: &isDirectory)
            && isDirectory.boolValue
    }

    // MARK: - Private
}
