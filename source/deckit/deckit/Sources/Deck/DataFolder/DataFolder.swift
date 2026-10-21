//
//  DataFolder.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The folders mods keep their own data in, one a mod, named by its id: whatever of a mod writes there.
public final class DataFolder {
    // MARK: - Property
    private let countLimit = 1000
    private let depthLimit = 8
    public let folder: URL
    private let store: Store

    // MARK: - Initializer
    init(folder: URL, store: Store) {
        self.folder = folder
        self.store = store
    }

    // MARK: - Public
    func folder(of mod: String) -> URL {
        folder.appending(path: mod)
    }

    // Every file in the mod's data folder counts, whatever wrote it: erasing takes them all.
    func count(mod: String) -> DataCount {
        var count = DataCount()
        walk(folder(of: mod), depth: 0, count: &count)
        return count
    }

    func erase(mod: String) throws {
        try store.remove(folder(of: mod))
    }

    // MARK: - Private
    // A file or a folder whose name starts with a dot is not counted, only noted.
    private func walk(_ location: URL, depth: Int, count: inout DataCount) {
        let keys: [URLResourceKey] = [.isDirectoryKey, .isRegularFileKey]
        let entries = (try? FileManager.default.contentsOfDirectory(at: location, includingPropertiesForKeys: keys))
            ?? []
        for entry in entries {
            guard !count.capped else { return }

            let values = try? entry.resourceValues(forKeys: Set(keys))
            if entry.lastPathComponent.hasPrefix(".") {
                count.hidden = true
            } else if values?.isDirectory == true && depth < depthLimit {
                walk(entry, depth: depth + 1, count: &count)
            } else if values?.isRegularFile == true && count.count >= countLimit {
                count.capped = true
            } else if values?.isRegularFile == true {
                count.count += 1
            }
        }
    }
}
