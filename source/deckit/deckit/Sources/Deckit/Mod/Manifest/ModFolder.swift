//
//  ModFolder.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// A folder a mod is in: its manifest, and the entry the manifest names. Who the mod is is the manifest's to say, not the
// folder's name.
struct ModFolder {
    // MARK: - Property
    private let reader: ManifestReader
    private let store: Store

    // MARK: - Initializer
    init(reader: ManifestReader, store: Store) {
        self.reader = reader
        self.store = store
    }

    // MARK: - Public
    // The mod folders in `root`, in the order of their names. A folder that holds no manifest, a regular file found as
    // `file` finds one, is not a broken mod but no mod, and a dot name (.shipped) is deck's own.
    func mods(in root: URL) -> [URL] {
        ((try? store.names(in: root)) ?? [])
            .filter { name in name.unicodeScalars.first != "." }
            .sorted()
            .map { name in root.appending(path: name) }
            .filter { folder in store.isFolder(folder) && manifestFile(of: folder) != nil }
    }

    // What the manifest in a folder says. One that names no id is the folder's name.
    func manifest(of folder: URL) -> Manifest {
        reader.read(
            manifestFile(of: folder).flatMap(store.read) ?? "",
            fallback: folder.standardizedFileURL.lastPathComponent
        )
    }

    // What the mod in a folder is refused with, as a `system` mod or not, or nil when it loads.
    func problem(of folder: URL, system: Bool) -> ModFolderError? {
        guard let text = manifestFile(of: folder).flatMap(store.read) else {
            return .notLoadable("no \(reader.file) in \(folder.path(percentEncoded: false))")
        }
        if let problem = reader.problem(of: text, system: system) {
            return .notLoadable(problem)
        }

        let manifest = manifest(of: folder)
        let main = manifest.main ?? ""
        guard file(main, in: folder) != nil else {
            return .notLoadable("main = \"\(main)\" names no file in the mod's folder")
        }

        return nil
    }

    // Where the file `path` names really is, or nil when that is no regular file inside the folder, by a link too.
    // Each segment names the entry of the folder it is looked up in whose name is the same sequence of Unicode scalar
    // values, found in that folder's listing: opening the name on a disk that ignores case or normalization finds an
    // entry of another spelling too.
    func file(_ path: String, in folder: URL) -> URL? {
        guard let root = realPath(folder.path(percentEncoded: false)) else { return nil }

        var place = root
        for segment in path.unicodeScalars.split(separator: "/", omittingEmptySubsequences: false) {
            let names = (try? store.names(in: URL(filePath: place))) ?? []
            guard names.contains(where: { name in name.unicodeScalars.elementsEqual(segment) }),
                let resolved = realPath(place + "/" + String(Substring(segment)))
            else { return nil }

            place = resolved
        }
        guard place.hasPrefix(root.hasSuffix("/") ? root : root + "/"),
            (try? FileManager.default.attributesOfItem(atPath: place))?[.type] as? FileAttributeType == .typeRegular
        else { return nil }

        return URL(filePath: place)
    }

    // MARK: - Private
    private func manifestFile(of folder: URL) -> URL? {
        file(reader.file, in: folder)
    }

    private func realPath(_ path: String) -> String? {
        guard let resolved = realpath(path, nil) else { return nil }
        defer { free(resolved) }

        return String(cString: resolved)
    }
}
