//
//  Deck.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The kernel's process side: it runs the jobs it is handed, each mod in a sandbox and with storage of its own, and lets
// the runs reach each other.
public final class Deck {
    // MARK: - Property
    public let records: Record
    // What the layers on deck keep for each mod, each under a name it reserves.
    public let modState: ModState
    public let dataFolder: DataFolder
    public let storage: ModStorage
    public let erasure: Erasure
    public let owners: OwnerTable
    public let connections: ConnectionBroker
    public let events: EventBus
    private let runner: Runner
    // Interface -> its owner, as the runs were last told.
    private var announced: [String: String] = [:]

    // MARK: - Initializer
    // `home` is the folder deck keeps its files in.
    public init(home: URL) {
        let store = Store()
        let settings = DeckSettings(file: home.appending(path: "deck.json"), store: store)
        let record = Record(folder: home.appending(path: "records", directoryHint: .isDirectory), store: store)
        let dataFolder = DataFolder(folder: home.appending(path: "data", directoryHint: .isDirectory), store: store)
        let modState = ModState(root: home.appending(path: "mod-state", directoryHint: .isDirectory), store: store)
        let storage = ModStorage(dataFolder: dataFolder, record: record, modState: modState, store: store)
        let owners = OwnerTable(store: OwnershipStore(settings: settings))
        let runner = Runner()
        self.records = record
        self.modState = modState
        self.dataFolder = dataFolder
        self.storage = storage
        self.erasure = Erasure(storage: storage, settings: settings, store: store)
        self.owners = owners
        self.runner = runner
        self.connections = ConnectionBroker(runner: runner, owners: owners)
        self.events = EventBus(runner: runner, owners: owners)
    }

    // MARK: - Public
    // The job the mod's sandbox runs, while it has one.
    public func job(of id: String) -> Job? {
        runner.job(of: id)
    }

    // The mod's latest run, while it has a sandbox.
    public func run(of id: String) -> Run? {
        runner.run(of: id)
    }

    // What the runs come to once the owner table changed: a connection to an interface's owner ends as it has another,
    // and one to the owner now stands.
    public func reconnect() -> [Effect] {
        withChanges([])
    }

    public func load(_ jobs: [Job]) throws -> [Effect] {
        try withChanges(runner.load(jobs))
    }

    public func unload(_ ids: [String]) throws -> [Effect] {
        try withChanges(runner.unload(ids))
    }

    // The `run`th run of `id` started, with what it contributes.
    public func started(_ id: String, run: Int, contributions: Contribution) throws -> [Effect] {
        try judged(id, run: run, runner.started(id, run: run, contributions: contributions))
    }

    // What the running `run`th run of `id` contributes now: the lifecycles stacked on the run join theirs after it
    // started, and leave as they end.
    public func joined(_ id: String, run: Int, contributions: Contribution) throws -> [Effect] {
        try judged(id, run: run, runner.joined(id, run: run, contributions: contributions))
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
    // What is wrong with what the run reaches by is recorded against it, and against each run that reaches it.
    private func judged(_ id: String, run number: Int, _ effects: [Effect]) throws -> [Effect] {
        var effects = effects
        if let run = runner.run(of: id), run.number == number {
            for problem in connections.problems(of: run) {
                effects += try runner.report(id, run: number, problem: problem)
            }
        }
        for job in runner.jobs() {
            let names = job.reaches + job.uses.keys
            guard names.contains(where: { name in connections.provider(of: name, for: job.modId) == id }),
                let dependent = runner.run(of: job.modId)
            else { continue }
            for problem in connections.problems(of: dependent) {
                effects += try runner.report(job.modId, run: dependent.number, problem: problem)
            }
        }
        return withChanges(effects)
    }

    // What the runs moving to `effects` come to besides: what each is told has changed of what other mods give it, then
    // `<interface>:owner-changed`, of no args, to those that listen for each interface whose owner changed since they
    // were last told.
    private func withChanges(_ effects: [Effect]) -> [Effect] {
        events.dropEnded()
        let owners = owners.ownership.owners()
        let changed = Set(owners.keys).union(announced.keys).filter { interface in
            owners[interface] != announced[interface]
        }
        announced = owners
        let deliveries = changed.sorted()
            .map { interface in events.announce(.owner, of: interface) }
            .filter { delivery in !delivery.listeners.isEmpty }

        return effects + connections.changes() + deliveries.map(Effect.deliver)
    }
}
