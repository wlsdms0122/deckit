//
//  Catalog.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Every mod deck reads: those read in place from a source folder, ahead of an installed one of the same id, and the
// installed ones. Each loads or says why not, and all come in their load order. Each interface a mod names has a list
// of the mods that implement it, and the first of them that is on is picked for it.
public final class Catalog {
    // MARK: - Property
    private let sources: [URL]
    private let ship: [URL]
    public let folder: URL
    private let modFolder: ModFolder
    private let dataFolder: DataFolder
    private let installer: Installer
    private let loadOrder: LoadOrder
    private let implementationOrder: ImplementationOrder
    // Interface -> the mods the host app places in its list, in order, until the person orders them.
    private let implementations: [String: [String]]
    private let store: Store
    // Mod id -> how many times it was installed while deck ran.
    private var installs: [String: Int] = [:]
    // The mods as they were last read: what runs.
    private(set) var lastRead: [Mod] = []
    // Each interface's list, as the mods were last read.
    public private(set) var interfaces: [InterfaceList] = []
    // Those of them that load, in their load order.
    public var loading: [Mod] {
        lastRead.filter { mod in mod.problem == nil }
    }

    // MARK: - Initializer
    // `folder` is deck's mods folder, `sources` the folders of mods read in place, `ship` the folders of what the app
    // ships, and `implementations`, by interface, the mods the app places in its list.
    init(
        folder: URL,
        sources: [URL],
        ship: [URL],
        modFolder: ModFolder,
        dataFolder: DataFolder,
        installer: Installer,
        loadOrder: LoadOrder,
        implementationOrder: ImplementationOrder,
        implementations: [String: [String]],
        store: Store
    ) {
        self.folder = folder
        self.sources = sources
        self.ship = ship
        self.modFolder = modFolder
        self.dataFolder = dataFolder
        self.installer = installer
        self.loadOrder = loadOrder
        self.implementationOrder = implementationOrder
        self.implementations = implementations
        self.store = store
    }

    // MARK: - Public
    // Every mod in its load order, whether it loads or not. One that loads comes after the mods it requires, and
    // otherwise each comes as the load order kept places it; one it does not place goes where the app ships it, and one
    // the app does not ship goes last, by id.
    func mods() -> [Mod] {
        resolve().mods
    }

    // The mods, read and kept as read, with each interface's list.
    func read() -> [Mod] {
        (lastRead, interfaces) = resolve()
        return lastRead
    }

    // The id of the mod picked for `interface`, as the mods were last read, or nil while none is.
    func pick(of interface: String) -> String? {
        interfaces.first { list in list.interface == interface }?.pick?.id
    }

    // As the person's: the implementations in `order` take the places they held among themselves in the interface's
    // list, in the order given, and those in `off` are switched off. One missing from the list now keeps its place and
    // switch, so editing the list while it was gone keeps what the person set of it. Refused when the picks it comes to
    // would put a mod that loads before one it requires, or make a cycle of mods that load now.
    public func order(_ interface: String, order: [String], off: [String]) throws {
        let found = ranked()
        let kept = implementationOrder.read()
        let before = InterfaceLists(found: found, kept: kept, host: implementations)
        guard before.lists.contains(where: { list in list.interface == interface }) else {
            throw LoadOrderError.noInterface(interface)
        }

        let given = Set(order)
        let preference = kept[interface] ?? .none
        let placed = preference.order
            + (implementations[interface] ?? []).filter { id in !preference.order.contains(id) }
        var next = order[...]
        var after = kept
        after[interface] = ImplementationPreference(
            order: placed.compactMap { id in given.contains(id) ? next.popFirst() : id } + next,
            off: preference.off.filter { id in !given.contains(id) } + off
        )

        let now = DependencyGraph(found, picks: before.picks).ordered()
        let loading = Set(now.filter { mod in mod.problem == nil }.map(\.manifest.id))
        let unresolved = now.compactMap { mod in found.first { other in other.manifest.id == mod.manifest.id } }
        let graph = DependencyGraph(
            unresolved,
            picks: InterfaceLists(found: found, kept: after, host: implementations).picks
        )
        if let loop = graph.cycles().first(where: { loop in loop.contains(where: loading.contains) }) {
            throw LoadOrderError.cycle(loop)
        }
        if let (mod, requirement) = graph.requiredLater() {
            throw LoadOrderError.requiredLater(mod: mod, requirement: requirement)
        }
        try implementationOrder.write(after)
    }

    // The ids named take the places they held among themselves in the load order, in the order given; the rest stay
    // put. An order that puts a mod that loads before one it requires is refused.
    public func arrange(_ ids: [String]) throws {
        let found = ranked()
        let picks = InterfaceLists(found: found, kept: implementationOrder.read(), host: implementations).picks
        let mods = DependencyGraph(found, picks: picks).ordered()
        var seen: Set<String> = []
        let moved = ids
            .filter { id in seen.insert(id).inserted }
            .compactMap { id in mods.first { mod in mod.manifest.id == id } }
        let places = mods.indices.filter { place in
            moved.contains { mod in mod.manifest.id == mods[place].manifest.id }
        }
        var next = mods
        for (place, mod) in zip(places, moved) {
            next[place] = mod
        }

        if let (mod, requirement) = DependencyGraph(next, picks: picks).requiredLater() {
            throw LoadOrderError.requiredLater(mod: mod, requirement: requirement)
        }
        try loadOrder.write(next.map(\.manifest.id))
    }

    public func planInstall(from source: URL) throws -> InstallPlan {
        try installer.planInstall(from: source, refuse: shadow)
    }

    public func install(from source: URL) throws -> Manifest {
        let manifest = try installer.install(from: source, refuse: shadow)
        installs[manifest.id, default: 0] += 1
        keepOrder(installed: [manifest.id])

        return manifest
    }

    // A mod read in place is removed where it is read. Answers whether deck keeps anything under its id: one that is
    // no mod id never loaded, so it stored nothing.
    public func remove(_ id: String) throws -> Bool {
        if let mod = list().first(where: { mod in mod.manifest.id == id }), isReadInPlace(mod) {
            throw InstallError.readInPlace(id: id, folder: mod.folder.path(percentEncoded: false))
        }

        try installer.remove(id)
        keepOrder(removed: [id])
        return store.isName(id)
    }

    public func installShipped() throws -> [InstallReport] {
        let reports = try installer.installShipped()
        keepOrder(
            installed: reports.filter { report in report.outcome == .installed }.map(\.id),
            removed: reports.filter { report in report.outcome == .dropped }.map(\.id)
        )
        return reports
    }

    // MARK: - Private
    // The mods found, as `list()` reads them, in the order the load order kept, the app ships them, then by id.
    private func ranked() -> [Mod] {
        let kept = loadOrder.read()
        let shipOrder = ship.map { source in modFolder.manifest(of: source).id }
        let rank = { (id: String) in
            (kept.firstIndex(of: id) ?? kept.count, shipOrder.firstIndex(of: id) ?? shipOrder.count, id)
        }

        return list().sorted { mod, other in rank(mod.manifest.id) < rank(other.manifest.id) }
    }

    // Every mod in its load order, and each interface's list, the picks of which join the mods.
    private func resolve() -> (mods: [Mod], interfaces: [InterfaceList]) {
        let found = ranked()
        let interfaces = InterfaceLists(found: found, kept: implementationOrder.read(), host: implementations)

        return (DependencyGraph(found, picks: interfaces.picks).ordered(), interfaces.lists)
    }

    // The load order kept with the mods `installed` that it did not place, each just before the first it places that
    // comes after it now, and without those `removed`, which leave every interface's order too; every other place
    // stays. A settings file that does not read as a JSON object keeps no order until it does, which arranging tells.
    private func keepOrder(installed: [String] = [], removed: [String] = []) {
        try? implementationOrder.remove(removed)
        let before = loadOrder.read()
        var kept = before.filter { id in !removed.contains(id) }
        let order = mods().map(\.manifest.id)
        for id in installed where !kept.contains(id) {
            let after = order.firstIndex(of: id).map { place in Set(order[(place + 1)...]) } ?? []
            kept.insert(id, at: kept.firstIndex { other in after.contains(other) } ?? kept.count)
        }
        if kept != before {
            try? loadOrder.write(kept)
        }
    }

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

        return found
    }

    private func mod(_ manifest: Manifest, in source: URL, installed: Bool, shipped: Bool, problem: String?) -> Mod {
        let revision = [
            source.path(percentEncoded: false),
            manifest.version ?? "",
            String(installs[manifest.id] ?? 0)
        ] + manifest.permissions.map { requested in "\(requested.id)=\(requested.reason)" }

        return Mod(
            manifest: manifest,
            folder: source,
            data: dataFolder.folder(of: manifest.id),
            installed: installed,
            shipped: shipped,
            problem: problem,
            hides: [],
            revision: revision.joined(separator: "\n"),
            relations: [],
            dependents: [],
            entry: manifest.main.flatMap { main in modFolder.entry(of: source, main: main) }
        )
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
