//
//  DataFolder.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The folders principals keep their own data in, one a principal, named by its id: whatever of a principal writes
// there.
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
    package func folder(of principal: String) -> URL {
        folder.appending(path: principal)
    }

    // Every file in the principal's data folder counts, whatever wrote it: erasing takes them all.
    func count(principal: String) -> DataCount {
        var count = DataCount()
        walk(folder(of: principal), depth: 0, count: &count)
        return count
    }

    func erase(principal: String) throws {
        try store.remove(folder(of: principal))
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
