//
//  Installer.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The copies of mods in deck's mods folder, each installed whole as mods/<id>, in the order they were installed, and
// what the app ships installed by one rule, with the system mods among them.
final class Installer {
    // MARK: - Property
    // Deck's folder, which holds the mods and all else deck keeps.
    private let home: URL
    private let folder: URL
    // Beside the mods, on the same disk so an install ends in a rename, and outside them so a copy half made is never
    // read as a mod.
    private let staging: URL
    // Inside the mods, so what removes them removes the lists too.
    private let shippedList: URL
    private let installedList: URL
    private let systemList: URL
    private let ship: [ShippedMod]
    private let modFolder: ModFolder
    private let store: Store

    // What the app ships that did not install at this start, by mod id.
    private(set) var failures: [String: InstallFailure] = [:]

    // MARK: - Initializer
    // `folder` is deck's mods folder in `home`, and `ship` what the app ships.
    init(home: URL, folder: URL, ship: [ShippedMod], modFolder: ModFolder, store: Store) {
        self.home = home
        self.folder = folder
        self.staging = home.appending(path: ".mods-installing")
        self.shippedList = folder.appending(path: ".shipped")
        self.installedList = folder.appending(path: ".installed")
        self.systemList = folder.appending(path: ".system")
        self.ship = ship
        self.modFolder = modFolder
        self.store = store
    }

    // MARK: - Public
    // What installing the folder `source` does, the mod read as no system mod's, or a throw that says why not: the
    // refusal the folder is read with, or a folder that, every link followed, lies inside deck's folder or holds it, as
    // copying would take the source with it.
    func installation(of source: URL) throws -> Installation {
        let manifest = try manifest(of: source, system: false)
        let place = modFolder.realPath(of: source) ?? source.standardizedFileURL.path(percentEncoded: false)
        let own = modFolder.realPath(of: home) ?? home.standardizedFileURL.path(percentEncoded: false)
        guard !isInside(place, own) && !isInside(own, place) else {
            throw InstallError.nested
        }

        return Installation(manifest: manifest, replaces: installed()[manifest.id] != nil)
    }

    // The mod `installation` was read from, installed from `source` as no system mod, and its id no more among those
    // shipped, so it stays at each later start.
    func install(_ installation: Installation, from source: URL) throws {
        let id = installation.manifest.id
        try place(installation.manifest, from: source, system: false)
        if let shipped = read(shippedList), shipped.contains(id) {
            try write(shipped.filter { shipped in shipped != id }, to: shippedList)
        }
    }

    // The installed mod with this id, every copy of it. What it stored stays.
    func remove(_ id: String) throws {
        guard let copies = installed()[id] else { throw InstallError.notInstalled(id) }
        for copy in copies {
            try store.remove(copy)
        }
        try write(installOrder().filter { installed in installed != id }, to: installedList)
        try mark(id, system: false)
    }

    // The ids installed, in the order each was first installed: one installed again keeps its place.
    func installOrder() -> [String] {
        read(installedList) ?? []
    }

    // The ids whose installed copy was installed from what the app ships.
    func shipped() -> Set<String> {
        Set(read(shippedList) ?? [])
    }

    // The ids of the system mods installed.
    func systemMods() -> Set<String> {
        Set(read(systemList) ?? [])
    }

    // What the app ships installed by one rule. An id shipped before and not installed now was removed, and stays out.
    // An id installed and not shipped before was installed from elsewhere, and stays as it is. The rest is installed,
    // and an id shipped before and no more is taken away. Removals are recorded nowhere else.
    //
    // One that does not install fails alone, and is not listed as shipped unless it was before: the next start tries
    // it again rather than take it for removed. A second folder shipped with an id is ignored.
    func installShipped() throws -> [InstallReport] {
        var reports: [InstallReport] = []
        var shipping: [String: ShippedMod] = [:]
        var order: [String] = []
        for shipped in ship {
            let id = modFolder.manifest(of: shipped.folder).id
            guard shipping[id] == nil else {
                let problem = "\(shipped.folder.path(percentEncoded: false)) has its id too"
                reports.append(InstallReport(id: id, outcome: .ignored, problem: problem))
                continue
            }

            shipping[id] = shipped
            order.append(id)
        }
        let before = shipped()
        let copies = installed()
        var list: [String] = []
        var taken: [String] = []
        failures = [:]
        for id in order {
            switch (before.contains(id), copies[id] != nil) {
            case (true, false):
                list.append(id)
                reports.append(InstallReport(id: id, outcome: .leftOut))

            case (false, true):
                reports.append(InstallReport(id: id, outcome: .kept))

            default:
                taken.append(id)
            }
        }
        for id in before.sorted() where shipping[id] == nil {
            guard copies[id] != nil else { continue }
            try remove(id)
            reports.append(InstallReport(id: id, outcome: .dropped))
        }
        for id in taken {
            guard let shipped = shipping[id] else { continue }

            do {
                let manifest = try manifest(of: shipped.folder, system: shipped.system)
                try place(manifest, from: shipped.folder, system: shipped.system)
                list.append(id)
                reports.append(InstallReport(id: id, outcome: .installed, version: manifest.version))
            } catch {
                if before.contains(id) {
                    list.append(id)
                }
                failures[id] = InstallFailure(shipped: shipped, problem: error)
                let problem = (error as? any Refusal)?.message ?? error.localizedDescription
                reports.append(InstallReport(id: id, outcome: .failed, problem: problem))
            }
        }
        try write(order.filter(list.contains), to: shippedList)

        return reports
    }

    // MARK: - Private
    // What the manifest in `source` says, as a `system` mod or not, or the refusal the folder is read with.
    private func manifest(of source: URL, system: Bool) throws -> Manifest {
        if let problem = modFolder.problem(of: source, system: system) {
            throw problem
        }

        return modFolder.manifest(of: source)
    }

    // Installed as mods/<id>, every copy before it taken away wherever it was, so a file the new version dropped is
    // not left to load. Only a whole staged copy takes the old one's place. It is a system mod from now on as `system`
    // says.
    private func place(_ manifest: Manifest, from source: URL, system: Bool) throws {
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
        let order = installOrder()
        if !order.contains(manifest.id) {
            try write(order + [manifest.id], to: installedList)
        }
        try mark(manifest.id, system: system)
    }

    // A list of ids, one a line, or nil while there is none.
    private func read(_ list: URL) -> [String]? {
        store.read(list).map { text in text.split(separator: "\n").map(String.init) }
    }

    private func write(_ ids: [String], to list: URL) throws {
        try store.write(ids.map { id in id + "\n" }.joined(), to: list)
    }

    private func mark(_ id: String, system: Bool) throws {
        let marked = read(systemList) ?? []
        guard marked.contains(id) != system else { return }

        try write(system ? marked + [id] : marked.filter { marked in marked != id }, to: systemList)
    }

    // The installed copies of each mod, by id, whatever their folders are named, in the order they are read: the first
    // is the one read.
    private func installed() -> [String: [URL]] {
        modFolder.mods(in: folder).reduce(into: [:]) { copies, copy in
            copies[modFolder.manifest(of: copy).id, default: []].append(copy)
        }
    }

    // Whether the path `inner` is `outer`, or a path under it.
    private func isInside(_ inner: String, _ outer: String) -> Bool {
        URL(filePath: inner).pathComponents.starts(with: URL(filePath: outer).pathComponents)
    }
}
