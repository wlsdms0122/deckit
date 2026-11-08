//
//  Deckit.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The platform on deck: the mods it reads and when they run, and the deck it is on.
public final class Deckit {
    // MARK: - Property
    public let deck: Deck
    public let catalog: Catalog
    // The state the layers above keep, each its own.
    public let state: State
    public let runs: RunTable
    // A mod at the relaunch limit launches again only as its launch is asked.
    private var limit: RelaunchLimit
    // The permissions deckit defines itself: a mod granted `mods` asks that another launch, one granted `reachMods`
    // may reach every mod by its id, and the services let one granted `systemServices` act on other mods.
    static let mods = Permission(
        id: "deckit.mods",
        name: "Mods",
        description: "It can see every mod, launch and quit them, add one from a folder and delete installed ones, "
            + "with what they stored.",
        privileged: true
    )
    static let reachMods = Permission(
        id: "deckit.reach-mods",
        name: "Reach Mods",
        description: "It connects to any mod by its id, which launches the mod if it does not run.",
        privileged: true
    )
    static let systemServices = Permission(
        id: "deckit.system-services",
        name: "System Services",
        description: "It can act on other mods through the system's services: run their commands, change their keys "
            + "and settings, and choose which mod opens an address.",
        privileged: true
    )
    private let now: () -> Date

    // MARK: - Initializer
    // `home` is deckit's folder, `ship` the mods the app ships, and `sources` folders of mods read in place. A manifest
    // is read against `api`, the mod contract the mods are run with, deckit's own permissions and `permissions`, those
    // the layers the driver runs define, and `fields`, the names of the fields the layers add to the manifest, whose
    // values it carries for them. `limit` is how often a mod's runs may fail, `now` the time a run fails at.
    public init(
        home: URL,
        ship: [ShippedMod],
        sources: [URL],
        api: Version,
        permissions: [Permission],
        fields: [String] = [],
        limit: RelaunchLimit = RelaunchLimit(burst: 5, interval: 10),
        now: @escaping () -> Date = Date.init
    ) throws {
        let store = Store()
        let deck = Deck(home: home)
        let reader = try ManifestReader(
            api: api,
            permissions: [Deckit.mods, Deckit.reachMods, Deckit.systemServices] + permissions,
            fields: fields,
            store: store
        )
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods", directoryHint: .isDirectory)
        let catalog = Catalog(
            folder: folder,
            sources: sources,
            modFolder: modFolder,
            dataFolder: deck.dataFolder,
            installer: Installer(home: home, folder: folder, ship: ship, modFolder: modFolder, store: store),
            ownerTable: deck.owners,
            store: store
        )
        let state = State(root: home.appending(path: "state", directoryHint: .isDirectory), store: store)
        let runs = RunTable()
        self.deck = deck
        self.catalog = catalog
        self.state = state
        self.runs = runs
        self.limit = limit
        self.now = now
    }

    // MARK: - Public
    // The mods read again, as the catalog reads them now.
    public func readCatalog() -> [Mod] {
        catalog.read()
    }

    // What the runs come to once the catalog was read again.
    public func reconnect() throws -> [Effect] {
        try observed(deck.reconnect())
    }

    // The background mods launch, as the catalog was last read and in its order.
    public func start() throws -> [Effect] {
        let background = catalog.loading.filter { mod in mod.manifest.background != nil }

        return try observed(deck.load(jobs(of: background.map(\.manifest.id))))
    }

    // The mods named that load launch, as the catalog was last read and in its order. One at the relaunch limit is
    // left as it is.
    public func load(_ ids: [String]) throws -> [Effect] {
        try observed(deck.load(jobs(of: ids)))
    }

    // The mod `id` launches as asked: what it failed before is forgotten first, which takes it off the relaunch
    // limit. `asker` is the mod that asks, refused unless it is granted `deckit.mods`; with none, nothing is checked.
    // Refused for an id no mod is listed under, and for one whose mod does not load, as the catalog was last read.
    public func launch(_ id: String, by asker: String?) throws -> [Effect] {
        try permit(asker)
        try listed(id)
        limit.reset(id)

        return try observed(deck.load(jobs(of: [id])))
    }

    // The mod `id` quits as asked, as `unload` unloads it. `asker` is refused as `launch` refuses it, and so is an id
    // no mod is listed under.
    public func quit(_ id: String, by asker: String?) throws -> [Effect] {
        try permit(asker)
        guard catalog.lastRead.contains(where: { mod in mod.manifest.id == id }) else {
            throw LaunchError.notInstalled(id)
        }

        return try unload([id])
    }

    // The mods named unload: a sandbox whose run has ended closes once the catalog no longer has its mod as it runs it.
    public func unload(_ ids: [String]) throws -> [Effect] {
        let ending = ids.filter { id in
            guard let run = deck.run(of: id) else { return false }
            return run.state != .notRunning || isGone(id)
        }

        return try observed(deck.unload(ending))
    }

    // The `run`th run of `id` started, with what it contributes.
    public func started(_ id: String, run number: Int, contributions: Contribution) throws -> [Effect] {
        try observed(deck.started(id, run: number, contributions: contributions))
    }

    // What the running `run`th run of `id` contributes now.
    public func joined(_ id: String, run number: Int, contributions: Contribution) throws -> [Effect] {
        try observed(deck.joined(id, run: number, contributions: contributions))
    }

    public func report(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try observed(deck.report(id, run: run, problem: problem))
    }

    public func notStarted(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try observed(deck.notStarted(id, run: run, problem: problem))
    }

    // The `run`th run of `id`, launching, has not started in time: it fails to launch, timed out.
    public func timedOut(_ id: String, run number: Int) throws -> [Effect] {
        guard let run = deck.run(of: id), run.number == number, run.state == .launching else { return [] }
        runs.timeOut(run)

        return try observed(deck.notStarted(id, run: number, problem: "its code did not start in time"))
    }

    // What `run` is refused with at launch once it has ended, the first that is so: its mod at the relaunch limit, it
    // timed out, it did not launch. Nil while it has not ended, and for one that ended otherwise.
    public func refusal(of run: Run) -> LaunchError? {
        guard run.state == .notRunning, let entry = runs.entry(of: run) else { return nil }
        if limit.isReached(by: run.modId) {
            return .relaunchLimit(run.modId)
        }
        let problem = run.problem ?? ""
        if entry.timedOut {
            return .timedOut(mod: run.modId, problem: problem)
        }
        guard run.failed, run.contributions == nil else { return nil }

        return .notLaunched(mod: run.modId, problem: problem)
    }

    public func crashed(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try observed(deck.crashed(id, run: run, problem: problem))
    }

    public func stopped(_ id: String, run: Int) throws -> [Effect] {
        try observed(deck.stopped(id, run: run))
    }

    // The `lifecycle`th lifecycle of the `run`th run of `id` has ended.
    public func ended(_ id: String, run: Int, lifecycle: Int) throws -> [Effect] {
        try observed(deck.ended(id, run: run, lifecycle: lifecycle))
    }

    // The `lifecycle`th lifecycle of the `run`th run of `id` asks to reach the mod `target` by its id, as deck reaches
    // it: the mod it waits for launches.
    public func reach(_ target: String, from id: String, run: Int, lifecycle: Int) throws -> [Effect] {
        try observed(deck.reach(target, from: id, run: run, lifecycle: lifecycle))
    }

    // The lifecycle lets the mod `target` go, as deck releases it.
    public func release(_ target: String, from id: String, run: Int, lifecycle: Int) throws -> [Effect] {
        try observed(deck.release(target, from: id, run: run, lifecycle: lifecycle))
    }

    // MARK: - Private
    private func permit(_ asker: String?) throws {
        guard let asker, !(deck.job(of: asker)?.permissions.contains(Deckit.mods.id) ?? false) else { return }
        throw LaunchError.notPermitted(mod: asker, permission: Deckit.mods.id)
    }

    // Refused for an id no mod is listed under, and for one whose mod does not load.
    private func listed(_ id: String) throws {
        guard let mod = catalog.lastRead.first(where: { mod in mod.manifest.id == id }) else {
            throw LaunchError.notInstalled(id)
        }
        guard let problem = mod.problem else { return }
        throw ModFolderError.notLoadable((problem as? any Refusal)?.message ?? problem.localizedDescription)
    }

    // The jobs of the mods named that load, as the catalog was last read and in its order, but for those at the
    // relaunch limit.
    private func jobs(of ids: [String]) -> [Job] {
        catalog.loading.compactMap { mod in
            guard ids.contains(mod.manifest.id), !limit.isReached(by: mod.manifest.id) else { return nil }
            return Job(mod)
        }
    }

    // What deckit keeps and decides of the runs as `effects` move them, then of what that comes to, until nothing more
    // comes: a run that launches has an entry; a run that failed counts toward its mod's relaunch limit, and a
    // background mod's launches again; a mod a lifecycle waits for launches; and a sandbox closes once its run has
    // ended and the catalog no longer has its mod as it runs it.
    private func observed(_ effects: [Effect]) throws -> [Effect] {
        var observed: [Effect] = []
        var next = effects
        while !next.isEmpty {
            observed += next
            var closing: [String] = []
            var launching: [String] = []
            for effect in next {
                switch effect {
                case let .tell(.willLaunch, run):
                    runs.begin(run)

                case let .tell(_, run) where run.state == .notRunning:
                    if run.failed {
                        limit.fail(run.modId, at: now())
                    }
                    if run.failed, isBackground(run.modId) {
                        launching.append(run.modId)
                    }
                    if isGone(run.modId) {
                        closing.append(run.modId)
                    }

                case let .wait(_, _, service):
                    launching.append(service)

                default:
                    break
                }
            }
            let jobs = jobs(of: launching)
            next = try (closing.isEmpty ? [] : deck.unload(closing)) + (jobs.isEmpty ? [] : deck.load(jobs))
        }

        return observed
    }

    private func isBackground(_ id: String) -> Bool {
        catalog.loading.contains { mod in mod.manifest.id == id && mod.manifest.background != nil }
    }

    // Whether the catalog, as it was last read, no longer has the mod as its sandbox runs it.
    private func isGone(_ id: String) -> Bool {
        guard let job = deck.job(of: id) else { return true }

        return !catalog.loading.contains { mod in mod.manifest.id == id && mod.revision == job.revision }
    }
}
