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
    public let settings: Setting
    public let dataFolder: DataFolder
    public let storage: ModStorage
    // The mods found, installed and removed. Reading them again is deck's (`readCatalog()`).
    public let catalog: Catalog
    public let erasure: Erasure
    public let exports: ExportBroker
    public let extensions: ExtensionRegistry
    public let events: EventBus
    private let runner: Runner
    private var layers: [Layer] = []

    // MARK: - Initializer
    // `home` is deckit's folder, `ship` the folders of the mods the app ships, and `sources` folders of mods read in
    // place. A manifest is read against `api`, the mod contract the mods are run with, and with what the layers on deck
    // add to it: the `permissions` they guard what they add with, deck's own among them, and their `fields`.
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
        let reader = try ManifestReader(api: api, permissions: permissions, fields: fields, store: store)
        let modFolder = ModFolder(reader: reader, store: store)
        let state = State(root: home.appending(path: "state", directoryHint: .isDirectory), store: store)
        let record = Record(folder: home.appending(path: "records", directoryHint: .isDirectory), store: store)
        let dataFolder = DataFolder(folder: home.appending(path: "data", directoryHint: .isDirectory), store: store)
        let catalog = Catalog(
            folder: folder,
            sources: sources,
            ship: ship,
            modFolder: modFolder,
            dataFolder: dataFolder,
            installer: Installer(home: home, folder: folder, ship: ship, modFolder: modFolder, store: store),
            loadOrder: LoadOrder(file: home.appending(path: "deck.json"), store: store),
            store: store
        )
        let runner = Runner(catalog: catalog)
        let setting = Setting(
            folder: home.appending(path: "settings", directoryHint: .isDirectory),
            store: store,
            catalog: catalog,
            runner: runner
        )
        let storage = ModStorage(dataFolder: dataFolder, record: record, setting: setting, store: store)
        self.records = record
        self.state = state
        self.settings = setting
        self.dataFolder = dataFolder
        self.storage = storage
        self.catalog = catalog
        self.runner = runner
        self.erasure = Erasure(storage: storage, state: state, store: store)
        self.exports = ExportBroker(runner: runner)
        self.extensions = ExtensionRegistry(runner: runner)
        self.events = EventBus(runner: runner)
    }

    // MARK: - Public
    // What the mod's run contributed, from its launch until it has ended.
    package func contributions(of id: String) -> Contribution? {
        guard let run = runner.run(of: id), run.state == .running || run.state == .terminating else { return nil }
        return run.contributions
    }

    // `layer` is asked of each run as it starts, and of what has changed once the runs have moved.
    package func add(_ layer: Layer) {
        layers.append(layer)
    }

    // The mods read again, as the catalog reads them now.
    public func readCatalog() -> [Mod] {
        let mods = catalog.read()
        settings.forget()
        return mods
    }

    // What the runs come to for the catalog as it was last read.
    public func reconcile() throws -> [Effect] {
        try withChanges(runner.reconcile())
    }

    public func relaunch(_ id: String) throws -> [Effect] {
        try withChanges(runner.relaunch(id))
    }

    public func relaunchAll() throws -> [Effect] {
        try withChanges(runner.relaunchAll())
    }

    public func quit() throws -> [Effect] {
        try withChanges(runner.quit())
    }

    // The mod's page loaded.
    public func loaded(_ id: String) throws -> [Effect] {
        try withChanges(runner.loaded(id))
    }

    // The `run`th run of `id` started, with what its page reported: `summary` as a person reads it, and what it
    // contributed, which deck and each layer judge.
    public func started(_ id: String, run: Int, summary: JSONValue, contributions: Contribution) throws -> [Effect] {
        var effects = try runner.started(id, run: run, summary: summary, contributions: contributions)
        for problem in problems(of: id, run: run) {
            effects += try runner.report(id, run: run, problem: problem)
        }
        return withChanges(effects)
    }

    // The `run`th run of `id` declared its settings as its entry was read: a declaration deck does not read is a problem
    // of the run.
    public func declared(_ id: String, run number: Int, settings: [JSONValue]) throws -> [Effect] {
        guard let problems = self.settings.declare(settings, mod: id, run: number) else { return [] }

        var effects: [Effect] = []
        for problem in problems {
            effects += try runner.report(id, run: number, problem: problem)
        }
        return withChanges(effects)
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

    // MARK: - Private
    // What the runs moving to `effects` come to besides: what each is told has changed of what other mods give it, and
    // what each layer tells has changed of its own.
    private func withChanges(_ effects: [Effect]) -> [Effect] {
        effects
            + exports.changes()
            + extensions.changes()
            + layers.flatMap { layer in layer.changes() }.map(Effect.layer)
    }

    // What is wrong with what the `number`th run of `id` contributed, deck's and each layer's, once it has launched.
    private func problems(of id: String, run number: Int) -> [String] {
        guard let run = runner.run(of: id), run.number == number, let mod = runner.mod(of: id) else { return [] }

        return extensions.problems(of: run, mod: mod)
            + layers.flatMap { layer in layer.problems(run, mod) }
    }
}
