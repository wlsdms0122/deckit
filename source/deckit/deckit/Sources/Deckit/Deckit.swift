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
    public let timeout: RunTimeout
    // A mod at the relaunch limit launches again only as its launch is asked.
    private var limit: RelaunchLimit
    // Interface -> what the mods declare to it, as the runs were last told.
    private var told: [String: [Declaration]] = [:]
    // What deckit tells of an interface, `<interface>:contributions-changed`, as what the mods declare to it changes.
    static let contributionsChanged = "contributions-changed"
    // The permissions deckit defines itself: a mod granted `mods` asks that another launch, one granted `reachMods`
    // may reach every mod by its id, and the services let one granted `systemServices` act on other mods.
    static let mods = Permission(
        id: "deckit.mods",
        name: "Mods",
        description: "It can see every mod and the system's folders, launch and quit them, add one from a folder and "
            + "delete installed ones, with what they stored.",
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
    // values it carries for them. `limit` is how often a mod's runs may fail, `timeout` how long a run is given, `now`
    // the time a run fails at.
    public init(
        home: URL,
        ship: [ShippedMod],
        sources: [URL],
        api: Version,
        permissions: [Permission],
        fields: [String] = [],
        limit: RelaunchLimit = RelaunchLimit(burst: 5, interval: 10),
        timeout: RunTimeout = RunTimeout(launch: 20, end: 5),
        now: @escaping () -> Date = Date.init
    ) throws {
        let store = Store()
        let deck = Deck(home: home, signals: [Deckit.contributionsChanged])
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
        self.timeout = timeout
        self.now = now
    }

    // MARK: - Public
    // The mods read again, as the catalog reads them now.
    public func readCatalog() -> [Mod] {
        catalog.read()
    }

    // What the runs come to once the catalog was read again, then `<interface>:contributions-changed` for each
    // interface what the mods declare to differs from what the runs were last told.
    public func reconnect() throws -> [Effect] {
        let effects = try observed(deck.reconnect())
        let declarations = catalog.declarations
        let changed = Set(declarations.keys).union(told.keys).filter { interface in
            declarations[interface] != told[interface]
        }
        told = declarations

        return effects + changed.sorted().flatMap { interface in
            deck.announce(Deckit.contributionsChanged, of: interface)
        }
    }

    // The background mods launch, as the catalog was last read and in its order: what the mods declare is what the
    // runs are told from now on.
    public func start() throws -> [Effect] {
        told = catalog.declarations
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
        try listedOnly(id)

        return try unload([id])
    }

    // What deck keeps of the mod `id`, in each place it keeps it. Refused for an id no mod is listed under, as `quit`
    // refuses it.
    public func usage(_ id: String) throws -> StorageUsage {
        try listedOnly(id)

        return try deck.storage.usage(principal: id)
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
        if limit.isReached(by: run.principal) {
            return .relaunchLimit(run.principal)
        }
        let problem = run.problem ?? ""
        if entry.timedOut {
            return .timedOut(mod: run.principal, problem: problem)
        }
        guard run.failed, run.contributions == nil else { return nil }

        return .notLaunched(mod: run.principal, problem: problem)
    }

    // What a lifecycle that waits for the mod `id` is told it is refused with, the first that is so: what a launch of
    // it is refused with as the catalog was last read, its mod at the relaunch limit, what its latest run is refused
    // with at launch once it has ended. Nil while it launches or runs, and while it may launch.
    public func refusal(reaching id: String) -> (any Refusal)? {
        do {
            try listed(id)
        } catch {
            return error as? any Refusal
        }
        if limit.isReached(by: id) {
            return LaunchError.relaunchLimit(id)
        }

        return deck.run(of: id).flatMap(refusal(of:))
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
    // it: the mod it waits for launches. Refused unless the mod is granted `deckit.reach-mods`.
    public func reach(_ target: String, from id: String, run: Int, lifecycle: Int) throws -> [Effect] {
        guard deck.job(of: id)?.permissions.contains(Deckit.reachMods.id) ?? false else {
            throw LaunchError.notPermitted(mod: id, permission: Deckit.reachMods.id)
        }

        return try observed(deck.reach(target, from: id, run: run, lifecycle: lifecycle))
    }

    // The lifecycle lets the mod `target` go, as deck releases it.
    public func release(_ target: String, from id: String, run: Int, lifecycle: Int) throws -> [Effect] {
        try observed(deck.release(target, from: id, run: run, lifecycle: lifecycle))
    }

    // The transport connection `transport`, which arrived from outside, is admitted as the principal its claimant
    // proves to be, as deck verifies it: a run of that principal's job launches, hosted by the transport connection,
    // in a sandbox no other run shares. The job of a principal that comes from outside grants nothing: no permission,
    // no principal reached by id, no interface used or provided. Refused for a principal that runs already.
    public func admit(
        transport: String,
        principal: String,
        scheme: String,
        key: Data,
        signature: Data
    ) throws -> [Effect] {
        let principal = try deck.authentication.verify(
            transport: transport,
            principal: principal,
            scheme: scheme,
            key: key,
            signature: signature
        )
        guard (deck.run(of: principal)?.state ?? .notRunning) == .notRunning else {
            throw LaunchError.alreadyRunning(principal)
        }
        let job = Job(
            principal: principal,
            revision: "transport \(transport)",
            host: .transport(transport),
            permissions: [],
            reaches: .only([]),
            uses: [:],
            provides: [:]
        )

        return try observed(deck.load([job]))
    }

    // MARK: - Private
    private func permit(_ asker: String?) throws {
        guard let asker, !(deck.job(of: asker)?.permissions.contains(Deckit.mods.id) ?? false) else { return }
        throw LaunchError.notPermitted(mod: asker, permission: Deckit.mods.id)
    }

    // Refused for an id no mod is listed under, as the catalog was last read.
    @discardableResult
    private func listedOnly(_ id: String) throws -> Mod {
        guard let mod = catalog.lastRead.first(where: { mod in mod.manifest.id == id }) else {
            throw LaunchError.notInstalled(id)
        }
        return mod
    }

    // Refused for an id no mod is listed under, and for one whose mod does not load.
    private func listed(_ id: String) throws {
        guard let problem = try listedOnly(id).problem else { return }
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
    // background mod's launches again; a mod a lifecycle waits for launches, but for the lifecycles that wait again as
    // its run ends refused at launch, which are told that refusal; and a sandbox closes once its run has ended and the
    // catalog no longer has its mod as it runs it.
    private func observed(_ effects: [Effect]) throws -> [Effect] {
        var observed: [Effect] = []
        var next = effects
        while !next.isEmpty {
            observed += next
            var closing: [String] = []
            var launching: [String] = []
            var ended: [Run] = []
            var waited: [String] = []
            for effect in next {
                switch effect {
                case let .tell(.willLaunch, run):
                    runs.begin(run)

                case let .tell(_, run) where run.state == .notRunning:
                    ended.append(run)
                    if run.failed {
                        limit.fail(run.principal, at: now())
                    }
                    if run.failed, isBackground(run.principal) {
                        launching.append(run.principal)
                    }
                    if isGone(run.principal) {
                        closing.append(run.principal)
                    }

                case let .wait(_, _, service):
                    waited.append(service)

                default:
                    break
                }
            }
            let refused = Set(ended.filter { run in refusal(of: run) != nil }.map(\.principal))
            launching += waited.filter { service in !refused.contains(service) }
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
