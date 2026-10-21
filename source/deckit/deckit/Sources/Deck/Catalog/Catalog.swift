//
//  Catalog.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Every mod deck reads: those read in place from a source folder, ahead of an installed one of the same id, and the
// installed ones. Each loads or says why not, and those that load are in the person's order, kept in the state.
public final class Catalog {
    // MARK: - Property
    private let orderKey = "mod-order"
    private let sources: [URL]
    private let ship: [URL]
    public let folder: URL
    private let modFolder: ModFolder
    private let dataFolder: DataFolder
    private let installer: Installer
    private let state: State
    private let store: Store
    // Mod id -> how many times it was installed while deck ran.
    private var installs: [String: Int] = [:]
    // The mods as they were last read: what runs.
    private(set) var lastRead: [Mod] = []
    // Those of them that load, in the person's order.
    public var loading: [Mod] {
        lastRead.filter { mod in mod.problem == nil }
    }

    // MARK: - Initializer
    // `folder` is deck's mods folder, `sources` the folders of mods read in place, and `ship` the folders of what the
    // app ships.
    init(
        folder: URL,
        sources: [URL],
        ship: [URL],
        modFolder: ModFolder,
        dataFolder: DataFolder,
        installer: Installer,
        state: State,
        store: Store
    ) {
        self.folder = folder
        self.sources = sources
        self.ship = ship
        self.modFolder = modFolder
        self.dataFolder = dataFolder
        self.installer = installer
        self.state = state
        self.store = store
        state.reserve(orderKey)
    }

    // MARK: - Public
    // Those that load, in the person's order, then those that do not, by id. One never placed goes where the app ships
    // it, and one the app does not ship goes last, by id.
    func mods() -> [Mod] {
        let found = list()
        let placed = order()
        let shipOrder = ship.map { source in modFolder.manifest(of: source).id }
        let rank = { (id: String) in
            if let place = placed.firstIndex(of: id) { return place }
            if let place = shipOrder.firstIndex(of: id) { return placed.count + place }
            return placed.count + shipOrder.count
        }

        let loading = found
            .filter { mod in mod.problem == nil }
            .sorted { mod, other in
                (rank(mod.manifest.id), mod.manifest.id) < (rank(other.manifest.id), other.manifest.id)
            }
        let failing = found
            .filter { mod in mod.problem != nil }
            .sorted { mod, other in mod.manifest.id < other.manifest.id }

        return loading + failing
    }

    // The mods, read and kept as read.
    func read() -> [Mod] {
        lastRead = mods()

        return lastRead
    }

    // The ids named take the places they held among themselves, in the order given; the rest stay put.
    public func arrange(_ ids: [String]) throws {
        var next = mods().filter { mod in mod.problem == nil }.map(\.manifest.id)
        var seen: Set<String> = []
        let moved = ids.filter { id in next.contains(id) && seen.insert(id).inserted }
        let places = next.indices.filter { place in moved.contains(next[place]) }
        for (place, id) in zip(places, moved) {
            next[place] = id
        }

        let text = String(decoding: try JSONEncoder().encode(next), as: UTF8.self)
        try state.write(reserved: orderKey, text: text)
    }

    public func wouldInstall(from source: URL) throws -> InstallPlan {
        try installer.wouldInstall(from: source, refuse: shadow)
    }

    public func install(from source: URL) throws -> Manifest {
        let manifest = try installer.install(from: source, refuse: shadow)
        installs[manifest.id, default: 0] += 1

        return manifest
    }

    // A mod read in place is removed where it is read. Answers whether deck keeps anything under its id: one that is
    // no mod id never loaded, so it stored nothing.
    public func remove(_ id: String) throws -> Bool {
        if let mod = list().first(where: { mod in mod.manifest.id == id }), isReadInPlace(mod) {
            throw InstallError.readInPlace(id: id, folder: mod.folder.path(percentEncoded: false))
        }

        try installer.remove(id)
        return store.isName(id)
    }

    public func installShipped() throws -> [InstallReport] {
        try installer.installShipped()
    }

    // MARK: - Private
    // By id, the first folder of an id the one read. What the app ships and did not install, with no copy to read, is
    // read where the app ships it, and does not load.
    private func list() -> [Mod] {
        let shipped = installer.shipped() ?? []
        var found: [Mod] = []
        var places: [String: Int] = [:]
        for root in sources + [folder] {
            for source in modFolder.mods(in: root) {
                let manifest = modFolder.manifest(of: source)
                if let place = places[manifest.id] {
                    found[place].hides.append(source)
                    continue
                }

                let installed = root == folder
                places[manifest.id] = found.count
                found.append(
                    mod(
                        manifest,
                        in: source,
                        installed: installed,
                        shipped: installed && shipped.contains(manifest.id),
                        problem: modFolder.problem(of: source)
                    )
                )
            }
        }
        found.sort { mod, other in mod.manifest.id < other.manifest.id }

        for (id, failure) in installer.failures.sorted(by: { one, other in one.key < other.key })
        where places[id] == nil {
            found.append(
                mod(
                    modFolder.manifest(of: failure.folder),
                    in: failure.folder,
                    installed: false,
                    shipped: true,
                    problem: "did not install: " + failure.problem
                )
            )
        }

        return DependencyGraph(found).resolved()
    }

    private func mod(_ manifest: Manifest, in source: URL, installed: Bool, shipped: Bool, problem: String?) -> Mod {
        let revision = [
            source.path(percentEncoded: false),
            manifest.version ?? "",
            String(installs[manifest.id] ?? 0)
        ] + manifest.permissions.map { requested in "\(requested.permission.id)=\(requested.reason)" }

        return Mod(
            manifest: manifest,
            folder: source,
            data: dataFolder.folder(of: manifest.id),
            installed: installed,
            shipped: shipped,
            problem: problem,
            hides: [],
            revision: revision.joined(separator: "\n"),
            dependencies: [],
            dependents: [],
            entry: manifest.main.flatMap { main in modFolder.entry(of: source, main: main) }
        )
    }

    private func order() -> [String] {
        guard let text = try? state.read(folder: nil, key: orderKey) else { return [] }
        return (try? JSONDecoder().decode([String].self, from: Data(text.utf8))) ?? []
    }

    // A source folder of the same id would hide the installed copy.
    private func shadow(_ manifest: Manifest) -> String? {
        guard let source = list().first(where: { mod in mod.manifest.id == manifest.id && isReadInPlace(mod) }) else {
            return nil
        }

        return "\(manifest.id) is read from \(source.folder.path(percentEncoded: false)), which would hide the "
            + "installed copy"
    }

    private func isReadInPlace(_ mod: Mod) -> Bool {
        !mod.installed && !mod.shipped
    }
}
