//
//  State.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What the person arranged and what deck and the layers on it keep between runs: JSON by key, one file a key, in the
// state folder or in a folder of its own one down, for one who names its keys as it likes. Deck keeps the text it is
// handed and never reads what it says.
final class State {
    // MARK: - Property
    private let fileExtension = "json"
    private let root: URL
    private let store: Store

    // MARK: - Initializer
    init(root: URL, store: Store) {
        self.root = root
        self.store = store
    }

    // MARK: - Public
    // `folder` names the folder of its own a key is kept in, or nil for the state folder.
    func read(folder: String?, key: String) throws -> String? {
        store.read(try file(in: folder, key: key))
    }

    func write(folder: String?, key: String, text: String) throws {
        try store.write(text, to: try file(in: folder, key: key))
    }

    // Every key kept, those of the state folder first, then each folder's, by name.
    func all() throws -> [StateEntry] {
        let folders = try store.names(in: root)
            .filter { name in store.isName(name) && store.isFolder(root.appending(path: name)) }
            .sorted()

        return try entries(in: root, folder: nil)
            + folders.flatMap { name in
                try entries(in: root.appending(path: name, directoryHint: .isDirectory), folder: name)
            }
    }

    // MARK: - Private
    private func entries(in location: URL, folder: String?) throws -> [StateEntry] {
        try store.names(in: location)
            .sorted()
            .compactMap { name in
                let file = location.appending(path: name)
                let key = file.deletingPathExtension().lastPathComponent
                guard file.pathExtension == fileExtension, store.isName(key), let text = store.read(file) else {
                    return nil
                }

                return StateEntry(folder: folder, key: key, text: text)
            }
    }

    private func file(in folder: String?, key: String) throws -> URL {
        guard store.isName(key) else { throw StateError.notAKey(key) }
        return try location(of: folder).appending(path: key).appendingPathExtension(fileExtension)
    }

    private func location(of folder: String?) throws -> URL {
        guard let folder else { return root }
        guard store.isName(folder) else { throw StateError.notAFolder(folder) }

        return root.appending(path: folder, directoryHint: .isDirectory)
    }
}
