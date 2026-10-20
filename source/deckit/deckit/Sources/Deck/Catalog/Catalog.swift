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
    private let folder: URL
    private let modFolder: ModFolder
    private let installer: Installer
    private let state: State
    private let store: Store
    // Mod id -> how many times it was installed while deck ran.
    private var installs: [String: Int] = [:]
    // The mods as they were last read: what runs.
    private(set) var lastRead: [Mod] = []

    // MARK: - Initializer
    // `folder` is deck's mods folder, `sources` the folders of mods read in place, and `ship` the folders of what the
    // app ships.
    init(
        folder: URL,
        sources: [URL],
        ship: [URL],
        modFolder: ModFolder,
        installer: Installer,
        state: State,
        store: Store
    ) {
        self.folder = folder
        self.sources = sources
        self.ship = ship
        self.modFolder = modFolder
        self.installer = installer
        self.state = state
        self.store = store
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
        try state.write(folder: nil, key: orderKey, text: text)
    }

    public func wouldInstall(from source: URL) throws -> Manifest {
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

        return withRequirements(found)
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
            installed: installed,
            shipped: shipped,
            problem: problem,
            hides: [],
            revision: revision.joined(separator: "\n"),
            dependencies: [],
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

    // A cycle fails every mod in it; then a failure spreads to whoever requires it, until nothing changes. Each lists
    // what it requires, then its optional dependencies, which stop nothing.
    private func withRequirements(_ found: [Mod]) -> [Mod] {
        var found = found
        let places = Dictionary(found.enumerated().map { place, mod in (mod.manifest.id, place) }) { first, _ in first }
        for loop in cycles(in: found, places: places) {
            for id in loop {
                guard let place = places[id], found[place].problem == nil else { continue }
                found[place].problem = "requires itself: " + loop.joined(separator: " → ")
            }
        }

        var changed = true
        while changed {
            changed = false
            for place in found.indices where found[place].problem == nil {
                for (id, want) in found[place].manifest.requires.sorted(by: { one, other in one.key < other.key }) {
                    guard let problem = dependencyProblem(id, want: want, provider: places[id].map { found[$0] }) else {
                        continue
                    }

                    found[place].problem = problem
                    changed = true
                    break
                }
            }
        }

        let provided = found
        for place in found.indices {
            let manifest = found[place].manifest
            found[place].dependencies = dependencies(manifest.requires, optional: false, in: provided, places: places)
                + dependencies(manifest.optional, optional: true, in: provided, places: places)
        }

        return found
    }

    private func dependencies(
        _ wanted: [String: String],
        optional: Bool,
        in found: [Mod],
        places: [String: Int]
    ) -> [Dependency] {
        wanted.sorted { one, other in one.key < other.key }.map { id, want in
            let provider = places[id].map { place in found[place] }
            return Dependency(
                id: id,
                want: want,
                name: provider?.manifest.name ?? id,
                ok: dependencyProblem(id, want: want, provider: provider) == nil,
                optional: optional
            )
        }
    }

    private func dependencyProblem(_ id: String, want: String, provider: Mod?) -> String? {
        guard let provider else { return "needs \(id), which is not installed" }
        guard provider.problem == nil else { return "needs \(id), which did not load" }
        guard let version = provider.manifest.version.flatMap(Version.init),
            let wanted = Version(want),
            version.satisfies(wanted)
        else {
            return "needs \(id) \(want), and \(id) is \(provider.manifest.version ?? "of no version")"
        }

        return nil
    }

    private func cycles(in found: [Mod], places: [String: Int]) -> [[String]] {
        var visiting: Set<String> = []
        var visited: Set<String> = []
        var loops: [[String]] = []
        func visit(_ id: String, trail: [String]) {
            guard !visited.contains(id) else { return }
            if visiting.contains(id), let start = trail.firstIndex(of: id) {
                loops.append(Array(trail[start...]) + [id])
                return
            }

            visiting.insert(id)
            for other in found[places[id]!].manifest.requires.keys.sorted() where places[other] != nil {
                visit(other, trail: trail + [id])
            }
            visiting.remove(id)
            visited.insert(id)
        }

        for mod in found {
            visit(mod.manifest.id, trail: [])
        }

        return loops
    }
}
