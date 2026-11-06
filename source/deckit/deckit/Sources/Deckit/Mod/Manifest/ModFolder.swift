//
//  ModFolder.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// A folder a mod is in: its manifest, and the entry and the file of what it declares that the manifest names. Who the
// mod is is the manifest's to say, not the folder's name.
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
    // The mod folders in `root`, in the order of their names exactly as on disk: on a disk that ignores case, a name
    // matching only in another case is no mod's. A folder with no manifest is not a broken mod but no mod, and a dot
    // name (.shipped) is deck's own.
    func mods(in root: URL) -> [URL] {
        ((try? store.names(in: root)) ?? [])
            .filter { name in !name.hasPrefix(".") }
            .sorted()
            .map { name in root.appending(path: name) }
            .filter { folder in
                store.isFolder(folder)
                    && FileManager.default.fileExists(atPath: manifestFile(of: folder).path(percentEncoded: false))
            }
    }

    // What the manifest in a folder says. One that names no id is the folder's name.
    func manifest(of folder: URL) -> Manifest {
        reader.read(store.read(manifestFile(of: folder)) ?? "", fallback: folder.standardizedFileURL.lastPathComponent)
    }

    // Why the mod in a folder does not load, or nil when it does.
    func problem(of folder: URL) -> String? {
        guard let text = store.read(manifestFile(of: folder)) else {
            return "no \(reader.file) in \(folder.path(percentEncoded: false))"
        }
        if let problem = reader.problem(of: text) {
            return problem
        }

        let manifest = manifest(of: folder)
        let main = manifest.main ?? ""
        guard file(main, in: folder) != nil else {
            return "main = \"\(main)\" names no file in the mod's folder"
        }
        if let contributes = manifest.contributes {
            guard file(contributes, in: folder) != nil else {
                return "contributes = \"\(contributes)\" names no file in the mod's folder"
            }
            guard self.contributes(of: manifest, in: folder) != nil else {
                return "\(contributes) must hold a JSON object"
            }
        }

        return nil
    }

    // What the file the manifest's contributes names in a folder declares, or nil when it names none that is a JSON
    // object.
    func contributes(of manifest: Manifest, in folder: URL) -> [String: JSONValue]? {
        guard let contributes = manifest.contributes,
            let found = file(contributes, in: folder),
            let text = store.read(found),
            case let .object(declared) = try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
        else { return nil }

        return declared
    }

    // Where the file `path` names really is, or nil when that is no file inside the folder, by a link too.
    func file(_ path: String, in folder: URL) -> URL? {
        guard let root = realPath(folder.path(percentEncoded: false)),
            let file = realPath(root + "/" + path),
            file.hasPrefix(root.hasSuffix("/") ? root : root + "/"),
            (try? FileManager.default.attributesOfItem(atPath: file))?[.type] as? FileAttributeType == .typeRegular
        else { return nil }

        return URL(filePath: file)
    }

    // MARK: - Private
    private func manifestFile(of folder: URL) -> URL {
        folder.appending(path: reader.file)
    }

    private func realPath(_ path: String) -> String? {
        guard let resolved = realpath(path, nil) else { return nil }
        defer { free(resolved) }

        return String(cString: resolved)
    }
}
