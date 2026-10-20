//
//  Installer.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The copies of mods in deck's mods folder, each installed whole as mods/<id>, and what the app ships installed by one
// rule.
final class Installer {
    // MARK: - Property
    private let folder: URL
    // Beside the mods, on the same disk so an install ends in a rename, and outside them so a copy half made is never
    // read as a mod.
    private let staging: URL
    // Inside the mods, so what removes them removes the list too.
    private let shippedList: URL
    private let ship: [URL]
    private let modFolder: ModFolder
    private let store: Store

    // What the app ships that did not install at this start, by mod id.
    private(set) var failures: [String: InstallFailure] = [:]

    // MARK: - Initializer
    // `folder` is deck's mods folder in `home`, and `ship` the folders of what the app ships.
    init(home: URL, folder: URL, ship: [URL], modFolder: ModFolder, store: Store) {
        self.folder = folder
        self.staging = home.appending(path: ".mods-installing")
        self.shippedList = folder.appending(path: ".shipped")
        self.ship = ship
        self.modFolder = modFolder
        self.store = store
    }

    // MARK: - Public
    // The manifest of a folder that can be installed, or a throw that says why not: a mod deck would not load, or a
    // folder that holds the installed copy or is held by it, as copying would take the source with it. `refuse` adds
    // the caller's own reason, or nil.
    func wouldInstall(from source: URL, refuse: (Manifest) -> String? = { _ in nil }) throws -> Manifest {
        if let problem = modFolder.problem(of: source) {
            throw InstallError.notLoadable(problem)
        }

        let manifest = modFolder.manifest(of: source)
        let target = folder.appending(path: manifest.id)
        let copies = installed()[manifest.id] ?? []
        guard !copies.contains(where: { copy in isSame(copy, source) }) else {
            throw InstallError.installedThere
        }
        guard !(copies + [target]).contains(where: { copy in isInside(source, copy) || isInside(copy, source) }) else {
            throw InstallError.nested
        }
        guard !FileManager.default.fileExists(atPath: target.path(percentEncoded: false))
            || copies.contains(where: { copy in isSame(copy, target) })
        else {
            throw InstallError.occupied(id: manifest.id, folder: target.path(percentEncoded: false))
        }
        if let reason = refuse(manifest) {
            throw InstallError.refused(reason)
        }

        return manifest
    }

    // Installed as mods/<id>, every copy before it taken away wherever it was, so a file the new version dropped is
    // not left to load. Only a whole staged copy takes the old one's place.
    func install(from source: URL, refuse: (Manifest) -> String? = { _ in nil }) throws -> Manifest {
        let manifest = try wouldInstall(from: source, refuse: refuse)
        let staged = staging.appending(path: manifest.id)
        try store.remove(staged)
        try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: source.resolvingSymlinksInPath(), to: staged)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        for copy in installed()[manifest.id] ?? [] {
            try store.remove(copy)
        }
        try FileManager.default.moveItem(at: staged, to: folder.appending(path: manifest.id))
        try store.remove(staging)

        return manifest
    }

    // The installed mod with this id, every copy of it. What it stored stays.
    func remove(_ id: String) throws {
        guard let copies = installed()[id] else { throw InstallError.notInstalled(id) }
        for copy in copies {
            try store.remove(copy)
        }
    }

    // The ids the app shipped at the last install of what it ships, or nil before the first.
    func shipped() -> Set<String>? {
        store.read(shippedList).map { text in Set(text.split(separator: "\n").map(String.init)) }
    }

    // What the app ships installed by one rule: a mod it shipped before and that is not installed now was removed by
    // the person, and stays out; the rest is installed. Removals are recorded nowhere else. An app that ships nothing
    // leaves what it shipped before as it is.
    //
    // One that does not install fails alone, and is not listed as shipped unless a copy of it is installed: the next
    // start tries it again rather than take it for removed. A second folder shipped with an id is ignored.
    func installShipped() throws -> [InstallReport] {
        guard !ship.isEmpty else { return [] }

        var reports: [InstallReport] = []
        var shipping: [String: URL] = [:]
        var order: [String] = []
        for source in ship {
            let id = modFolder.manifest(of: source).id
            guard shipping[id] == nil else {
                let problem = "\(source.path(percentEncoded: false)) has its id too"
                reports.append(InstallReport(id: id, outcome: .ignored, problem: problem))
                continue
            }

            shipping[id] = source
            order.append(id)
        }
        let before = shipped()
        let copies = installed()
        var taken: [String] = []
        failures = [:]
        for id in order {
            if before?.contains(id) == true && copies[id] == nil {
                reports.append(InstallReport(id: id, outcome: .leftOut))
            } else {
                taken.append(id)
            }
        }
        for id in (before ?? []).sorted() where shipping[id] == nil {
            guard let dropped = copies[id] else { continue }
            for copy in dropped {
                try store.remove(copy)
            }
            reports.append(InstallReport(id: id, outcome: .dropped))
        }
        for id in taken {
            guard let source = shipping[id] else { continue }

            do {
                let manifest = try install(from: source)
                reports.append(InstallReport(id: id, outcome: .installed, version: manifest.version))
            } catch {
                let problem = (error as? any CallError)?.message ?? error.localizedDescription
                failures[id] = InstallFailure(folder: source, problem: problem)
                reports.append(InstallReport(id: id, outcome: .failed, problem: problem))
            }
        }

        // A left out id stays on the list, so its absence keeps meaning it was removed.
        let now = installed()
        let list = order.filter { id in failures[id] == nil || now[id] != nil }
        try store.write(list.map { id in id + "\n" }.joined(), to: shippedList)

        return reports
    }

    // MARK: - Private
    // The installed copies of each mod, by id, whatever their folders are named, in the order they are read: the first
    // is the one read.
    private func installed() -> [String: [URL]] {
        modFolder.mods(in: folder).reduce(into: [:]) { copies, copy in
            copies[modFolder.manifest(of: copy).id, default: []].append(copy)
        }
    }

    private func isSame(_ one: URL, _ other: URL) -> Bool {
        one.standardizedFileURL.pathComponents == other.standardizedFileURL.pathComponents
    }

    // Whether `inner` is `outer`, or a path under it.
    private func isInside(_ inner: URL, _ outer: URL) -> Bool {
        inner.standardizedFileURL.pathComponents.starts(with: outer.standardizedFileURL.pathComponents)
    }
}
