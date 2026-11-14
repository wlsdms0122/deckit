//
//  ModFolder.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// A folder a mod is in: its manifest, and the entry the manifest names. Who the mod is is the manifest's to say, not
// the folder's name.
struct ModFolder {
    // MARK: - Property
    private let reader: ManifestReader
    private let store: Store
    // As many links as the system's own path lookup follows in one path.
    private let linkLimit = 32

    // MARK: - Initializer
    init(reader: ManifestReader, store: Store) {
        self.reader = reader
        self.store = store
    }

    // MARK: - Public
    // The mod folders in `root`, in the order of their names, a link followed as `file` follows one. A folder that
    // holds no manifest, a regular file found as `file` finds one, is not a broken mod but no mod, nor is anything but
    // a folder, and a dot name (.shipped) is deck's own.
    func mods(in root: URL) -> [URL] {
        guard let place = realPath(of: root) else { return [] }
        var links = 0

        return ((try? store.names(in: root)) ?? [])
            .filter { name in name.unicodeScalars.first != "." }
            .sorted()
            .filter { name in
                entry(name, in: place, links: &links).map { folder in store.isFolder(URL(filePath: folder)) } ?? false
            }
            .map { name in root.appending(path: name) }
            .filter { folder in manifestFile(of: folder) != nil }
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
    // Each segment is looked up as `entry` looks up a name.
    func file(_ path: String, in folder: URL) -> URL? {
        guard let root = realPath(of: folder) else { return nil }

        var links = 0
        var place = root
        for segment in path.unicodeScalars.split(separator: "/", omittingEmptySubsequences: false) {
            guard let next = entry(String(Substring(segment)), in: place, links: &links) else { return nil }
            place = next
        }
        guard place.hasPrefix(root.hasSuffix("/") ? root : root + "/"),
            (try? FileManager.default.attributesOfItem(atPath: place))?[.type] as? FileAttributeType == .typeRegular
        else { return nil }

        return URL(filePath: place)
    }

    // Where `folder` leads, every link on the way followed by the system's own lookup, or nil where it leads nowhere.
    func realPath(of folder: URL) -> String? {
        guard let resolved = realpath(folder.path(percentEncoded: false), nil) else { return nil }
        defer { free(resolved) }

        return String(cString: resolved)
    }

    // MARK: - Private
    private func manifestFile(of folder: URL) -> URL? {
        file(reader.file, in: folder)
    }

    // Where the entry `name` of the folder at `place` leads: the entry whose name is the same sequence of Unicode
    // scalar values, found in the folder's listing, as opening the name on a disk that ignores case or normalization
    // finds an entry of another spelling too. A link leads where its target does, each name in the target looked up
    // the same way. Nil where a name names no entry, or past `linkLimit` links.
    private func entry(_ name: String, in place: String, links: inout Int) -> String? {
        let names = (try? store.names(in: URL(filePath: place))) ?? []
        guard names.contains(where: { listed in listed.unicodeScalars.elementsEqual(name.unicodeScalars) }) else {
            return nil
        }

        let entry = (place == "/" ? "" : place) + "/" + name
        guard let target = try? FileManager.default.destinationOfSymbolicLink(atPath: entry) else { return entry }
        links += 1
        guard links <= linkLimit else { return nil }

        var at = target.hasPrefix("/") ? "/" : place
        for part in target.unicodeScalars.split(separator: "/") {
            switch String(Substring(part)) {
            case ".":
                continue

            case "..":
                at = (at as NSString).deletingLastPathComponent

            case let name:
                guard let next = self.entry(name, in: at, links: &links) else { return nil }
                at = next
            }
        }

        return at
    }
}
