//
//  Deck.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The kernel: what a mod is, what it keeps, how it runs and what it gives other mods.
public final class Deck {
    // MARK: - Property
    // The state deck keeps, which a layer keeps its own in beside deck's.
    public let state: State
    public let records: Record
    // What the layers on deck keep for each mod, each under a name it reserves.
    public let modState: ModState
    public let dataFolder: DataFolder
    public let storage: ModStorage
    // The mods found, installed and removed. Reading them again is deck's (`readCatalog()`).
    public let catalog: Catalog
    public let erasure: Erasure
    public let connections: ConnectionBroker
    public let events: EventBus
    private let runner: Runner
    private var layers: [Layer] = []
    // Interface -> its owner, as the runs were last told.
    private var announced: [String: String] = [:]

    // MARK: - Initializer
    // `home` is deckit's folder, `ship` the folders of the mods the app ships, and `sources` folders of mods read in
    // place. A manifest is read against `api`, the mod contract the mods are run with, the `permissions` the layers on
    // this host define, deck's own among them, and the `fields` the layers on deck add.
    public init(
        home: URL,
        ship: [URL],
        sources: [URL],
        api: Version,
        permissions: [Permission],
        fields: [any ManifestField]
    ) throws {
        let store = Store()
        let folder = home.appending(path: "mods", directoryHint: .isDirectory)
        let reader = try ManifestReader(
            api: api,
            permissions: permissions,
            fields: fields,
            store: store
        )
        let modFolder = ModFolder(reader: reader, store: store)
        let state = State(root: home.appending(path: "state", directoryHint: .isDirectory), store: store)
        let record = Record(folder: home.appending(path: "records", directoryHint: .isDirectory), store: store)
        let dataFolder = DataFolder(folder: home.appending(path: "data", directoryHint: .isDirectory), store: store)
        let settings = home.appending(path: "deck.json")
        let catalog = Catalog(
            folder: folder,
            sources: sources,
            ship: ship,
            modFolder: modFolder,
            dataFolder: dataFolder,
            installer: Installer(home: home, folder: folder, ship: ship, modFolder: modFolder, store: store),
            loadOrder: LoadOrder(file: settings, store: store),
            ownershipStore: OwnershipStore(file: settings, store: store),
            store: store
        )
        let runner = Runner(catalog: catalog)
        let modState = ModState(root: home.appending(path: "mod-state", directoryHint: .isDirectory), store: store)
        let storage = ModStorage(dataFolder: dataFolder, record: record, modState: modState, store: store)
        self.records = record
        self.state = state
        self.modState = modState
        self.dataFolder = dataFolder
        self.storage = storage
        self.catalog = catalog
        self.runner = runner
        self.erasure = Erasure(storage: storage, state: state, store: store)
        self.connections = ConnectionBroker(runner: runner)
        self.events = EventBus(runner: runner)
    }

    // MARK: - Public
    // The mod's latest run, while it has a sandbox.
    package func run(of id: String) -> Run? {
        runner.run(of: id)
    }

    // What the mod's run contributed, from its launch until it has ended.
    package func contributions(of id: String) -> Contribution? {
        guard let run = runner.run(of: id), run.state == .running || run.state == .terminating else { return nil }
        return run.contributions
    }

    // `layer` is asked of each run as it starts, and of what has changed once the runs have moved, and told of each
    // sandbox that closed.
    package func add(_ layer: Layer) {
        layers.append(layer)
    }

    // The mods read again, as the catalog reads them now.
    public func readCatalog() -> [Mod] {
        catalog.read()
    }

    // What the runs come to once the catalog was read again: a connection to an interface's owner ends as it has
    // another, and one to the owner now stands.
    public func reconnect() -> [Effect] {
        withChanges([])
    }

    // The mods named load, as the catalog was last read.
    public func load(_ ids: [String]) throws -> [Effect] {
        try withChanges(runner.load(ids))
    }

    // The mods named unload.
    public func unload(_ ids: [String]) throws -> [Effect] {
        try withChanges(runner.unload(ids))
    }

    // The `run`th run of `id` read its entry: `summary` is what the layers read of it, as a person reads it.
    public func described(_ id: String, run: Int, summary: JSONValue) throws -> [Effect] {
        try withChanges(runner.described(id, run: run, summary: summary))
    }

    // The `run`th run of `id` started, with what its page reported: `summary` as a person reads it, and what it
    // contributed, which deck and each layer judge.
    public func started(_ id: String, run: Int, summary: JSONValue, contributions: Contribution) throws -> [Effect] {
        try judged(id, run: run, runner.started(id, run: run, summary: summary, contributions: contributions))
    }

    // What the running `run`th run of `id` contributes now, with what its page reported: the lifecycles stacked on the
    // run join theirs after it started, and leave as they end.
    public func joined(_ id: String, run: Int, summary: JSONValue, contributions: Contribution) throws -> [Effect] {
        try judged(id, run: run, runner.joined(id, run: run, summary: summary, contributions: contributions))
    }

    // A problem against the `run`th run of `id`.
    public func report(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try withChanges(runner.report(id, run: run, problem: problem))
    }

    public func notStarted(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try withChanges(runner.notStarted(id, run: run, problem: problem))
    }

    public func crashed(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try withChanges(runner.crashed(id, run: run, problem: problem))
    }

    public func stopped(_ id: String, run: Int) throws -> [Effect] {
        try withChanges(runner.stopped(id, run: run))
    }

    // The `lifecycle`th lifecycle of the `run`th run of `id` has ended: the connections it is an end of end.
    public func ended(_ id: String, run: Int, lifecycle: Int) -> [Effect] {
        connections.end(mod: id, run: run, lifecycle: lifecycle)
        return withChanges([])
    }

    // MARK: - Private
    // What deck and each layer find wrong with what the run contributes now is recorded against it, and what deck
    // finds wrong with what the runs that reach it wait for, against each of those.
    private func judged(_ id: String, run: Int, _ effects: [Effect]) throws -> [Effect] {
        var effects = effects
        for problem in problems(of: id, run: run) {
            effects += try runner.report(id, run: run, problem: problem)
        }
        for mod in runner.mods() {
            let names = Array(mod.manifest.dependencies.keys) + Array(mod.manifest.uses.keys)
            guard names.contains(where: { name in connections.provider(of: name, for: mod.manifest.id) == id }),
                let dependent = runner.run(of: mod.manifest.id)
            else { continue }
            for problem in connections.problems(of: dependent) {
                effects += try runner.report(mod.manifest.id, run: dependent.number, problem: problem)
            }
        }
        return withChanges(effects)
    }

    // What the runs moving to `effects` come to besides: what each is told has changed of what other mods give it, then
    // `<interface>:owner-changed`, of no args, to those that listen for each interface whose owner changed since they
    // were last told, and what each layer tells has changed of its own, once each layer has heard of the sandboxes that
    // closed.
    private func withChanges(_ effects: [Effect]) -> [Effect] {
        events.dropEnded()
        for case let .close(modId) in effects {
            for layer in layers {
                layer.closed(modId)
            }
        }

        let owners = runner.owners()
        let changed = Set(owners.keys).union(announced.keys).filter { interface in
            owners[interface] != announced[interface]
        }
        announced = owners
        let deliveries = changed.sorted()
            .map { interface in events.announce("\(interface):owner-changed") }
            .filter { delivery in !delivery.listeners.isEmpty }

        return effects
            + connections.changes()
            + deliveries.map(Effect.deliver)
            + layers.flatMap { layer in layer.changes() }.map(Effect.layer)
    }

    // What is wrong with what the `number`th run of `id` contributes, deck's and each layer's, once it has launched.
    private func problems(of id: String, run number: Int) -> [String] {
        guard let run = runner.run(of: id), run.number == number, let mod = runner.mod(of: id) else { return [] }

        return connections.problems(of: run)
            + layers.flatMap { layer in layer.problems(run, mod) }
    }
}
