//
//  Catalog.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// Every mod deckit reads: those read in place from a source folder, ahead of an installed one of the same id, and the
// installed ones. Each loads or says why not, and all come in the order they were installed. Each interface a mod
// provides has one owner, the provider the person pinned or else the one that began to provide it first, as deck's
// owner table keeps it from the jobs of the mods that load.
public final class Catalog {
    // MARK: - Property
    private let sources: [URL]
    public let folder: URL
    private let modFolder: ModFolder
    private let dataFolder: DataFolder
    private let installer: Installer
    private let ownerTable: OwnerTable
    private let store: Store
    // Mod id -> how many times it was installed while deck ran.
    private var installs: [String: Int] = [:]
    // The mods as they were last read: what runs.
    private(set) var lastRead: [Mod] = []
    // Each interface a mod provides or uses, as the mods were last read, by name.
    public private(set) var interfaces: [InterfaceQueue] = []
    // Those of them that load, in their order.
    public var loading: [Mod] {
        lastRead.filter { mod in mod.problem == nil }
    }
    // Interface -> what the mods that load declare to it, in their order, as the mods were last read.
    var declarations: [String: [Declaration]] {
        loading.reduce(into: [:]) { declarations, mod in
            for (interface, entries) in mod.manifest.contributes {
                declarations[interface, default: []] += entries.map { entry in
                    Declaration(mod: mod.manifest.id, name: mod.manifest.name, permissions: mod.granted, entry: entry)
                }
            }
        }
    }

    // MARK: - Initializer
    // `folder` is deck's mods folder, and `sources` the folders of mods read in place.
    init(
        folder: URL,
        sources: [URL],
        modFolder: ModFolder,
        dataFolder: DataFolder,
        installer: Installer,
        ownerTable: OwnerTable,
        store: Store
    ) {
        self.folder = folder
        self.sources = sources
        self.modFolder = modFolder
        self.dataFolder = dataFolder
        self.installer = installer
        self.ownerTable = ownerTable
        self.store = store
    }

    // MARK: - Public
    // Every mod, whether it loads or not, in the order they were installed, and one not installed last, by id.
    func mods() -> [Mod] {
        let found = ranked()
        return resolve(found, ownership: joined(ownerTable.ownership, by: found)).mods
    }

    // The mods, read and kept as read, with the ownership of each interface, which is kept as the mods provide now.
    func read() -> [Mod] {
        let found = ranked()
        (lastRead, interfaces) = resolve(found, ownership: keptOwnership(of: found))

        return lastRead
    }

    // What the mods that load declare to `interface`, as `declarations` holds it: handed only to `id` while deck's
    // owner table has it own the interface, so a pin or a read hands them to the new owner at once.
    public func declarations(to interface: String, for id: String) throws -> [Declaration] {
        guard ownerTable.ownership.owner(of: interface) == id else {
            throw DeclarationError.notOwner(interface: interface, mod: id)
        }

        return declarations[interface] ?? []
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

    // What installing a folder would do, refused too where a mod read in place has its id, which would hide the copy
    // installed.
    public func planInstall(from source: URL) throws -> InstallPlan {
        let plan = try installer.planInstall(from: source)
        if let mod = list().first(where: { mod in mod.manifest.id == plan.manifest.id }), isReadInPlace(mod) {
            throw InstallError.readInPlace(id: mod.manifest.id, folder: mod.folder.path(percentEncoded: false))
        }

        return plan
    }

    public func install(from source: URL) throws -> Manifest {
        let plan = try planInstall(from: source)
        try installer.install(plan, from: source)
        installs[plan.manifest.id, default: 0] += 1
        keptOwnership(of: ranked())

        return plan.manifest
    }

    // A mod read in place is removed where it is read. Answers whether deck keeps anything under its id: one that is
    // no mod id never loaded, so it stored nothing.
    public func remove(_ id: String) throws -> Bool {
        if let mod = list().first(where: { mod in mod.manifest.id == id }), isReadInPlace(mod) {
            throw InstallError.readInPlace(id: id, folder: mod.folder.path(percentEncoded: false))
        }

        try installer.remove(id)
        keptOwnership(of: ranked(), removed: [id])
        return store.isName(id)
    }

    public func installShipped() throws -> [InstallReport] {
        let reports = try installer.installShipped()
        keptOwnership(of: ranked(), removed: reports.filter { report in report.outcome == .dropped }.map(\.id))

        return reports
    }

    // MARK: - Private
    // The mods found, as `list()` reads them, in the order they were installed, then by id.
    private func ranked() -> [Mod] {
        let order = installer.installOrder()
        let rank = { (id: String) in (order.firstIndex(of: id) ?? order.count, id) }

        return list().sorted { mod, other in rank(mod.manifest.id) < rank(other.manifest.id) }
    }

    // `ownership` as the mods `found` provide now: those that load provide what their manifest names, as they arrive at
    // once in their order, and one found with a problem keeps the places it holds and its pins. An id not found leaves
    // when it was `removed`, and otherwise only while every mod found is who its manifest names: one whose manifest
    // names no id may be any of them.
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

    // The jobs of the mods `found` that load, those that provide what they name, in their order.
    private func providers(in found: [Mod]) -> [Job] {
        found.filter { mod in mod.problem == nil }.compactMap { mod in Job(mod) }
    }

    // The ownership deck keeps, as the mods `found` provide now and without those `removed`.
    @discardableResult
    private func keptOwnership(of found: [Mod], removed: [String] = []) -> Ownership {
        ownerTable.provide(
            providers(in: found),
            keeping: kept(in: ownerTable.ownership, by: found, removed: removed)
        )
    }

    // Every mod in its order, with what each interface it uses comes to, and each interface's queue. A provider is read
    // among every mod found, one with a problem too.
    private func resolve(_ found: [Mod], ownership: Ownership) -> (mods: [Mod], interfaces: [InterfaceQueue]) {
        let loading = found.filter { mod in mod.problem == nil }
        let manifests = found.map(\.manifest)
        let providers = self.providers(in: found)
        var mods = found
        for place in mods.indices {
            let manifest = mods[place].manifest
            mods[place].uses = manifest.uses.keys.sorted().map { interface in
                use(of: interface, by: manifest, found: manifests, in: ownership)
            }
        }
        let named = Set(ownership.queues.keys).union(loading.flatMap { mod in mod.manifest.uses.keys })
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

        return (mods, interfaces)
    }

    // By id, the first folder of an id the one read. What the app ships and did not install, with no copy to read, is
    // read where the app ships it, and does not load.
    private func list() -> [Mod] {
        let shipped = installer.shipped()
        let systemMods = installer.systemMods()
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
                let system = installed && systemMods.contains(manifest.id)
                places[manifest.id] = found.count
                found.append(
                    mod(
                        manifest,
                        in: source,
                        installed: installed,
                        shipped: installed && shipped.contains(manifest.id),
                        system: system,
                        problem: modFolder.problem(of: source, system: system)
                    )
                )
            }
        }
        found.sort { mod, other in mod.manifest.id < other.manifest.id }

        for (id, failure) in installer.failures.sorted(by: { one, other in one.key < other.key })
        where places[id] == nil {
            found.append(
                mod(
                    modFolder.manifest(of: failure.shipped.folder),
                    in: failure.shipped.folder,
                    installed: false,
                    shipped: true,
                    system: failure.shipped.system,
                    problem: failure.problem
                )
            )
        }

        return found
    }

    private func mod(
        _ manifest: Manifest,
        in source: URL,
        installed: Bool,
        shipped: Bool,
        system: Bool,
        problem: (any Error)?
    ) -> Mod {
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
            system: system,
            problem: problem,
            hides: [],
            revision: revision.joined(separator: "\n"),
            uses: [],
            entry: manifest.main.flatMap { main in modFolder.file(main, in: source) }
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

    private func isReadInPlace(_ mod: Mod) -> Bool {
        !mod.installed && !mod.shipped
    }
}
