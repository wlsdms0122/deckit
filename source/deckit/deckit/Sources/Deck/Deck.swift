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
    private let record: Record
    private let setting: Setting
    private let dataFolder: DataFolder
    private let catalog: Catalog
    private let runner: Runner
    private let erasure: Erasure
    private let exportBroker: ExportBroker
    private let extensionRegistry: ExtensionRegistry
    private let eventBus: EventBus
    private var layers: [any Layer] = []

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
            installer: Installer(home: home, folder: folder, ship: ship, modFolder: modFolder, store: store),
            state: state,
            store: store
        )
        let runner = Runner(catalog: catalog)
        let setting = Setting(
            folder: home.appending(path: "settings", directoryHint: .isDirectory),
            store: store,
            catalog: catalog,
            runner: runner
        )
        self.record = record
        self.state = state
        self.setting = setting
        self.dataFolder = dataFolder
        self.catalog = catalog
        self.runner = runner
        self.erasure = Erasure(dataFolder: dataFolder, record: record, setting: setting, state: state, store: store)
        self.exportBroker = ExportBroker(runner: runner)
        self.extensionRegistry = ExtensionRegistry(runner: runner)
        self.eventBus = EventBus(runner: runner)
    }

    // MARK: - Public
    // The mods that load, as the catalog was last read, in the person's order.
    public func mods() -> [Mod] {
        catalog.lastRead.filter { mod in mod.problem == nil }
    }

    // What the mod's run contributed, from its launch until it has ended.
    public func contributions(of id: String) -> Contribution? {
        guard let run = runner.run(of: id), run.state == .running || run.state == .terminating else { return nil }
        return run.contributions
    }

    // `layer` is asked of each run as it starts, and of what has changed once the runs have moved.
    public func add(_ layer: any Layer) {
        layers.append(layer)
    }

    // A mod's record under `key`, as JSON text, or none.
    public func readRecord(mod: String, key: String) throws -> String? {
        try record.read(mod: mod, key: key)
    }

    // `text` is JSON, as the record's file holds it.
    public func writeRecord(mod: String, key: String, text: String) throws {
        try record.write(mod: mod, key: key, text: text)
    }

    public func removeRecord(mod: String, key: String) throws {
        try record.remove(mod: mod, key: key)
    }

    public func recordKeys(mod: String) throws -> [String] {
        try record.keys(mod: mod)
    }

    public func countRecords(mod: String) throws -> RecordCount {
        try record.count(mod: mod)
    }

    // What a mod has saved of its settings, by key.
    public func settings(of mod: String) -> [String: SettingValue] {
        setting.read(mod: mod)
    }

    // What the `run`th run of `mod` declares as its entry is read, in the order declared: whether it was taken.
    public func declareSettings(_ settings: [SettingDeclaration], mod: String, run: Int) -> Bool {
        setting.declare(settings, mod: mod, run: run)
    }

    // The choices whose options its page works out, of `mod`, or of every mod for none.
    public func computedChoices(mod: String?) -> [SettingKey] {
        setting.computedChoices(mod: mod)
    }

    // Every mod's settings as Settings lists them, with the options the pages worked out for `choices`.
    public func listSettings(choices: [ComputedChoice]) -> [SettingGroup] {
        setting.list(choices: choices)
    }

    // A value asked for a mod's setting, and for a computed choice the options its page worked out.
    public func setSetting(
        mod: String,
        key: String,
        value: SettingValue?,
        options: [SettingOption]?
    ) throws -> SettingChange {
        try setting.set(mod: mod, key: key, value: value, options: options)
    }

    // Refused unless the mod declared `key` as an action, which its page runs.
    public func validateSettingAction(mod: String, key: String) throws {
        try setting.action(mod: mod, key: key)
    }

    // The mods read again, as the catalog reads them now.
    public func readCatalog() -> [Mod] {
        let mods = catalog.read()
        setting.forget()
        return mods
    }

    // The ids named take the places they held among themselves, in the order given; the rest stay put.
    public func arrange(_ ids: [String]) throws {
        try catalog.arrange(ids)
    }

    public func installShipped() throws -> [InstallReport] {
        try catalog.installShipped()
    }

    // What installing the mod in `folder` would install.
    public func wouldInstall(from folder: URL) throws -> Manifest {
        try catalog.wouldInstall(from: folder)
    }

    public func install(from folder: URL) throws -> Manifest {
        try catalog.install(from: folder)
    }

    // Whether the mod `id` was installed and is removed.
    public func remove(_ id: String) throws -> Bool {
        try catalog.remove(id)
    }

    public func countData(mod: String) throws -> DataCount {
        try dataFolder.count(mod: mod)
    }

    // What the mod kept is erased, noted until main has cleared what its pages kept.
    public func erase(mod: String) throws {
        try erasure.erase(mod: mod)
    }

    // The mods erased whose pages' storage main has not cleared yet.
    public func uncleared() -> [String] {
        erasure.uncleared()
    }

    public func cleared(mod: String) throws {
        try erasure.cleared(mod: mod)
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

    // The mod's sandbox was made: its page is loaded.
    public func load(_ id: String) throws -> [Effect] {
        try withChanges(runner.load(id))
    }

    // The `run`th run of `id` started, with what its page reported: `summary` as a person reads it, and what it
    // contributed, which deck and each layer judge.
    public func started(_ id: String, run: Int, summary: JSONValue, contributions: Contribution) throws -> [Effect] {
        var effects = try runner.started(id, run: run, summary: summary, contributions: contributions)
        for problem in problems(of: id, run: run) {
            effects += try runner.record(id, run: run, problem: problem)
        }
        return withChanges(effects)
    }

    // A problem against the `run`th run of `id`.
    public func recordProblem(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try withChanges(runner.record(id, run: run, problem: problem))
    }

    public func notStarted(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try withChanges(runner.notStarted(id, run: run, problem: problem))
    }

    public func crash(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try withChanges(runner.crash(id, run: run, problem: problem))
    }

    public func stopped(_ id: String, run: Int) throws -> [Effect] {
        try withChanges(runner.stopped(id, run: run))
    }

    // What the `run`th run of `mod` is given of what its dependencies export.
    public func dependencies(mod: String, run: Int) throws -> Poll<Dependencies> {
        try exportBroker.dependencies(mod: mod, run: run)
    }

    // Whether a call from the `run`th run of `caller` into the function at `path` of what `mod` exports goes.
    public func callExport(from caller: String, run: Int, mod: String, path: [String]) throws -> Poll<Bool> {
        try exportBroker.call(from: caller, run: run, mod: mod, path: path)
    }

    // Whether a call from the `run`th run of `caller` into the function at `path` of what `mod` extends `point` with
    // goes.
    public func callExtension(from caller: String, run: Int, mod: String, point: String, path: [String]) throws {
        try extensionRegistry.call(from: caller, run: run, mod: mod, point: point, path: path)
    }

    // Every scoped event name the `run`th run of `mod` listens to now.
    public func listen(mod: String, run: Int, names: [String]) {
        eventBus.listen(mod: mod, run: run, names: names)
    }

    // Who hears an event the `run`th run of `mod` sends of itself, by its own name for it.
    public func emit(mod: String, run: Int, name: String) -> EventDelivery {
        eventBus.emit(mod: mod, run: run, name: name)
    }

    // MARK: - Private
    // What the runs moving to `effects` come to besides: what each is told has changed of what other mods give it, and
    // what each layer tells has changed of its own.
    private func withChanges(_ effects: [Effect]) -> [Effect] {
        effects
            + exportBroker.changes()
            + extensionRegistry.changes()
            + layers.flatMap { layer in layer.changes() }.map(Effect.layer)
    }

    // What is wrong with what the `number`th run of `id` contributed, deck's and each layer's, once it has launched.
    private func problems(of id: String, run number: Int) -> [String] {
        guard let run = runner.run(of: id), run.number == number, let mod = runner.mod(of: id) else { return [] }

        return extensionRegistry.problems(of: run, mod: mod)
            + layers.flatMap { layer in layer.problems(of: run, mod: mod) }
    }
}
