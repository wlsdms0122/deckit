//
//  Record.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A principal's records: JSON by key, one file a key, kept apart from the principal's own data folder. Deck keeps the
// text it is handed and never reads what it says.
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
    public func read(principal: String, key: String) throws -> String? {
        store.read(try file(principal: principal, key: key))
    }

    // Refused once the disk has no room for it.
    public func write(principal: String, key: String, text: String) throws {
        let file = try file(principal: principal, key: key)
        do {
            try store.write(text, to: file)
        } catch let error as CocoaError where error.code == .fileWriteOutOfSpace {
            throw RecordError.outOfSpace(key)
        }
    }

    public func remove(principal: String, key: String) throws {
        try store.remove(try file(principal: principal, key: key))
    }

    public func keys(principal: String) throws -> [String] {
        try store.names(in: folder(of: principal))
            .compactMap { name in
                let file = URL(filePath: name)
                guard file.pathExtension == fileExtension else { return nil }

                let key = file.deletingPathExtension().lastPathComponent
                return store.isName(key) ? key : nil
            }
            .sorted()
    }

    func erase(principal: String) throws {
        try store.remove(folder(of: principal))
    }

    func count(principal: String) throws -> RecordCount {
        let names = try store.names(in: folder(of: principal))
        let hidden = names.filter { $0.hasPrefix(".") }
        return RecordCount(count: names.count - hidden.count, hidden: !hidden.isEmpty)
    }

    // MARK: - Private
    // The caller hands a principal that is a name, so it is a folder name.
    private func folder(of principal: String) -> URL {
        folder.appending(path: principal, directoryHint: .isDirectory)
    }

    private func file(principal: String, key: String) throws -> URL {
        guard store.isName(key) else { throw RecordError.notAKey(key) }
        return folder(of: principal).appending(path: key).appendingPathExtension(fileExtension)
    }
}
