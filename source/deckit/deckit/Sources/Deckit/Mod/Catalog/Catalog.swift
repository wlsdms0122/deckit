//
//  Catalog.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// Every mod deckit reads: those read in place from a source folder, ahead of an installed one of the same id, and the
// installed ones. Each loads or says why not, and all come in their order. Each interface a mod provides has one
// owner, the provider the person pinned or else the one that began to provide it first, as deck's owner table keeps
// it from the jobs of the mods that load.
public final class Catalog {
    // MARK: - Property
    private let sources: [URL]
    private let ship: [URL]
    public let folder: URL
    private let modFolder: ModFolder
    private let dataFolder: DataFolder
    private let installer: Installer
    private let order: Order
    private let ownerTable: OwnerTable
    private let startupList: StartupList
    private let store: Store
    // Mod id -> how many times it was installed while deck ran.
    private var installs: [String: Int] = [:]
    // The mods as they were last read: what runs.
    private(set) var lastRead: [Mod] = []
    // Each interface a mod provides or uses, as the mods were last read, by name.
    public private(set) var interfaces: [InterfaceQueue] = []
    // Interface -> its owner, as the mods were last read.
    private(set) var owners: [String: String] = [:]
    // The mods that stand in a list, as they were last read: those that load by their own manifest, whether what they
    // require is there or not and whether they run or not.
    public private(set) var listed: [Mod] = []
    // Those of them that load, in their order.
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
        order: Order,
        ownerTable: OwnerTable,
        startupList: StartupList,
        store: Store
    ) {
        self.folder = folder
        self.sources = sources
        self.ship = ship
        self.modFolder = modFolder
        self.dataFolder = dataFolder
        self.installer = installer
        self.order = order
        self.ownerTable = ownerTable
        self.startupList = startupList
        self.store = store
    }

    // MARK: - Public
    // Every mod in the order, whether it loads or not. One that loads comes after the mods it requires, and
    // otherwise each comes as the order kept places it; one it does not place goes where the app ships it, and one
    // the app does not ship goes last, by id.
    func mods() -> [Mod] {
        let found = ranked()
        return resolve(found, ownership: joined(ownerTable.ownership, by: found)).mods
    }

    // The mods, read and kept as read, with the ownership of each interface, which is kept as the mods provide now.
    // Each that loads is told what is wrong with what it declares.
    func read() -> [Mod] {
        let found = ranked()
        let ownership = keptOwnership(of: found)
        (lastRead, interfaces, listed) = resolve(found, ownership: ownership)
        owners = ownership.owners()
        for place in lastRead.indices where lastRead[place].problem == nil {
            lastRead[place].declarationProblems = lastRead[place].declared.problems
        }
        listed = listed.compactMap { mod in lastRead.first { read in read.manifest.id == mod.manifest.id } }

        return lastRead
    }

    // The id of the owner of `interface`, as the mods were last read, or nil while none provides it.
    func owner(of interface: String) -> String? {
        owners[interface]
    }

    // What the mods that load declare to `interface`, in their order, as the mods were last read: handed to its owner
    // `id` only.
    public func declarations(to interface: String, for id: String) throws -> [Declaration] {
        guard owners[interface] == id else { throw DeclarationError.notOwner(interface: interface, mod: id) }

        return declarations(to: interface)
    }

    // Each interface the mods that load declare anything to, with what they declare, as the mods were last read.
    func declarations() -> [String: [Declaration]] {
        let interfaces = Set(loading.flatMap { mod in mod.declared.entries.keys })
        return Dictionary(uniqueKeysWithValues: interfaces.map { interface in
            (interface, declarations(to: interface))
        })
    }

    // The text of the file `path` names inside the folder of the mod `id`, which loads as the mods were last read, or
    // nil when that is no file inside the folder, by a link too.
    public func text(of path: String, in id: String) -> String? {
        guard let mod = loading.first(where: { mod in mod.manifest.id == id }),
            let file = modFolder.file(path, in: mod.folder)
        else { return nil }

        return store.read(file)
    }

    // As the person's: `id` owns `interface` from now on, whichever provider is first in its queue, until its pin is
    // cleared, for nil, or the mod leaves the queue. Refused for a mod that does not provide the interface now, one
    // kept in its queue with a problem too. Settled once the mods are read again.
    public func pin(_ interface: String, to id: String?) throws {
        keptOwnership(of: ranked())
        try ownerTable.pin(interface, to: id)
    }

    // The ids named take the places they held among themselves in the mods' order, in the order given; the rest stay
    // put. An order that puts a mod that loads before one it requires is refused.
    public func arrange(_ ids: [String]) throws {
        let mods = DependencyGraph(ranked()).ordered()
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

        if let (mod, requirement) = DependencyGraph(next).requiredLater() {
            throw OrderError.requiredLater(mod: mod, requirement: requirement)
        }
        try order.write(next.map(\.manifest.id))
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

    // A mod the app ships that asks to run from the start is approved as it is installed, until the person decides.
    public func installShipped() throws -> [InstallReport] {
        let reports = try installer.installShipped()
        let installed = reports.filter { report in report.outcome == .installed }.map(\.id)
        keepOrder(
            installed: installed,
            removed: reports.filter { report in report.outcome == .dropped }.map(\.id)
        )
        let approvals = startupList.read()
        let asking = ship.map { source in modFolder.manifest(of: source) }
            .filter { manifest in manifest.startup != nil && installed.contains(manifest.id) }
            .map(\.id)
        let approved = asking.filter { id in approvals[id] == nil }
        if !approved.isEmpty {
            try? startupList.write(approvals.merging(approved.map { id in (id, true) }) { _, new in new })
        }

        return reports
    }

    // As the person's: the mod runs from the app's start from then on, for `approved`, or does not. Refused for a mod
    // whose manifest does not ask to. Settled once the mods are read again.
    public func approveStartup(_ id: String, _ approved: Bool) throws {
        guard list().contains(where: { mod in mod.manifest.id == id && mod.manifest.startup != nil }) else {
            throw StartupError.notAsked(id)
        }

        try startupList.write(startupList.read().merging([id: approved]) { _, new in new })
    }

    // MARK: - Private
    // The mods found, as `list()` reads them, as the order kept places them, then as the app ships them, then by id.
    private func ranked() -> [Mod] {
        let kept = order.read()
        let shipOrder = shipOrder()
        let rank = { (id: String) in
            (kept.firstIndex(of: id) ?? kept.count, shipOrder.firstIndex(of: id) ?? shipOrder.count, id)
        }

        return list().sorted { mod, other in rank(mod.manifest.id) < rank(other.manifest.id) }
    }

    private func shipOrder() -> [String] {
        ship.map { source in modFolder.manifest(of: source).id }
    }

    // `ownership` as the mods `found` provide now: those that load by their own manifest provide what it names, as
    // they arrive at once in the order the app ships them, then by id, and one found with a problem keeps the places
    // it holds and its pins. An id not found leaves when it was `removed`, and otherwise only while every mod found is
    // who its manifest names: one whose manifest names no id may be any of them. The order is not looked at.
    private func joined(_ ownership: Ownership, by found: [Mod], removed: [String] = []) -> Ownership {
        ownership.joined(by: providers(in: found), keeping: kept(in: ownership, by: found, removed: removed))
    }

    // The ids that keep the places they hold in `ownership` though they provide nothing now: those `found` with a
    // problem, and, while a mod found names no id, every one not found and not `removed`.
    private func kept(in ownership: Ownership, by found: [Mod], removed: [String]) -> Set<String> {
        let ids = Set(found.map(\.manifest.id))
        var kept = Set(found.filter { mod in mod.problem != nil }.map(\.manifest.id))
        if found.contains(where: { mod in !mod.manifest.namesID }) {
            kept.formUnion(ownership.queues.values.joined().filter { id in
                !ids.contains(id) && !removed.contains(id)
            })
        }

        return kept
    }

    // The jobs of the mods `found` that load, those that provide what they name, in the order the app ships them, then
    // by id.
    private func providers(in found: [Mod]) -> [Job] {
        let shipOrder = shipOrder()
        let rank = { (id: String) in (shipOrder.firstIndex(of: id) ?? shipOrder.count, id) }

        return found.filter { mod in mod.problem == nil }
            .sorted { mod, other in rank(mod.manifest.id) < rank(other.manifest.id) }
            .compactMap { mod in Job(mod) }
    }

    // The ownership deck keeps, as the mods `found` provide now and without those `removed`.
    @discardableResult
    private func keptOwnership(of found: [Mod], removed: [String] = []) -> Ownership {
        ownerTable.provide(
            providers(in: found),
            keeping: kept(in: ownerTable.ownership, by: found, removed: removed)
        )
    }

    // Every mod in the order, with what each interface it uses comes to, each interface's queue, and the mods that
    // stand in a list. A provider is read among every mod found, one with a problem too.
    private func resolve(
        _ found: [Mod],
        ownership: Ownership
    ) -> (mods: [Mod], interfaces: [InterfaceQueue], listed: [Mod]) {
        let listed = found.filter { mod in mod.problem == nil }
        let manifests = found.map(\.manifest)
        let providers = self.providers(in: found)
        var mods = DependencyGraph(found).ordered()
        for place in mods.indices {
            let manifest = mods[place].manifest
            mods[place].uses = manifest.uses.keys.sorted().map { interface in
                use(of: interface, by: manifest, found: manifests, in: ownership)
            }
        }
        let named = Set(ownership.queues.keys).union(listed.flatMap { mod in mod.manifest.uses.keys })
        let interfaces = named.sorted().map { interface in
            let definer = interface.split(separator: "/").first.map(String.init)
            return queue(
                of: interface,
                found: manifests,
                providers: providers,
                definer: found.first { mod in mod.manifest.id == definer }?.manifest.name,
                in: ownership
            )
        }

        return (mods, interfaces, listed)
    }

    // The order kept with the mods `installed` that it did not place, each just before the first it places that
    // comes after it now, and without those `removed`; every other place stays. The ownership is kept as the mods
    // provide now, without those `removed`. A settings file that does not read as a JSON object keeps no order until
    // it does, which arranging tells.
    private func keepOrder(installed: [String] = [], removed: [String] = []) {
        _ = keptOwnership(of: ranked(), removed: removed)
        let before = order.read()
        var kept = before.filter { id in !removed.contains(id) }
        let current = mods().map(\.manifest.id)
        for id in installed where !kept.contains(id) {
            let after = current.firstIndex(of: id).map { place in Set(current[(place + 1)...]) } ?? []
            kept.insert(id, at: kept.firstIndex { other in after.contains(other) } ?? kept.count)
        }
        if kept != before {
            try? order.write(kept)
        }
    }

    // By id, the first folder of an id the one read. What the app ships and did not install, with no copy to read, is
    // read where the app ships it, and does not load.
    private func list() -> [Mod] {
        let shipped = installer.shipped() ?? []
        let approvals = startupList.read()
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
                        approved: approvals[manifest.id] ?? false,
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
                    approved: approvals[id] ?? false,
                    problem: "did not install: " + failure.problem
                )
            )
        }

        return found
    }

    // `approved` for a mod the person approved to run from the start, which it is while its manifest asks to.
    private func mod(
        _ manifest: Manifest,
        in source: URL,
        installed: Bool,
        shipped: Bool,
        approved: Bool,
        problem: String?
    ) -> Mod {
        let revision = [
            source.path(percentEncoded: false),
            manifest.version ?? "",
            String(installs[manifest.id] ?? 0)
        ] + manifest.permissions.map { requested in "\(requested.id)=\(requested.reason)" }
        let contributes = modFolder.contributes(of: manifest, in: source) ?? [:]

        return Mod(
            manifest: manifest,
            folder: source,
            data: dataFolder.folder(of: manifest.id),
            installed: installed,
            shipped: shipped,
            startupApproved: approved && manifest.startup != nil,
            problem: problem,
            hides: [],
            revision: revision.joined(separator: "\n"),
            relations: [],
            uses: [],
            dependents: [],
            entry: manifest.main.flatMap { main in modFolder.file(main, in: source) },
            contributes: contributes,
            declared: InterfaceDeclaration(contributes: contributes),
            declarationProblems: []
        )
    }

    // The queue of `interface` in `ownership`, each provider read among `found`, the manifests of every mod found,
    // pinnable as it is among `providers`, the jobs of the mods that load, and `definer` the name of the mod that
    // defines it. One kept and
    // not found has no name and no majors.
    private func queue(
        of interface: String,
        found: [Manifest],
        providers: [Job],
        definer: String?,
        in ownership: Ownership
    ) -> InterfaceQueue {
        InterfaceQueue(
            interface: interface,
            name: definer,
            owner: ownership.owner(of: interface),
            pinned: ownership.pins[interface] != nil,
            providers: (ownership.queues[interface] ?? []).map { id in
                let manifest = found.first { manifest in manifest.id == id }
                return InterfaceProvider(
                    id: id,
                    name: manifest?.name,
                    majors: manifest?.provides[interface] ?? [],
                    pinnable: ownership.isPinnable(id, for: interface, among: providers)
                )
            }
        )
    }

    // What `interface` comes to for `manifest`, which uses it, as `ownership` owns it, its owner read among `found`, the
    // manifests of every mod found. An owner whose manifest is not read as providing it, one kept with a problem, is told by its own
    // problem.
    private func use(
        of interface: String,
        by manifest: Manifest,
        found: [Manifest],
        in ownership: Ownership
    ) -> InterfaceUse {
        let major = manifest.uses[interface]!
        guard let id = ownership.owner(of: interface), id != manifest.id else {
            return InterfaceUse(interface: interface, major: major, owner: nil, name: nil, problem: nil)
        }
        guard let owner = found.first(where: { provider in provider.id == id }) else {
            return InterfaceUse(
                interface: interface,
                major: major,
                owner: id,
                name: nil,
                problem: "uses \(interface) \(major), and its owner \(id) is not found, so it reaches no one by it"
            )
        }

        return InterfaceUse(
            interface: interface,
            major: major,
            owner: id,
            name: owner.name,
            problem: owner.provides[interface].flatMap { majors in
                majors.contains(major)
                    ? nil
                    : "uses \(interface) \(major), and its owner \(id) provides it at "
                        + majors.map(String.init).joined(separator: ", ") + ", so it reaches no one by it"
            }
        )
    }

    private func declarations(to interface: String) -> [Declaration] {
        loading.flatMap { mod in
            (mod.declared.entries[interface] ?? []).map { entry in
                Declaration(mod: mod.manifest.id, name: mod.manifest.name, entry: entry)
            }
        }
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
