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
    private let record: Record
    private let state: State
    private let setting: Setting
    private let dataFolder: DataFolder
    private let catalog: Catalog
    private let runner: Runner
    private let erasure: Erasure
    private let exportBroker: ExportBroker
    private let extensionRegistry: ExtensionRegistry
    private let eventBus: EventBus

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
    // What deck answers a call with, or nil for a method that is not deck's. A method that answers nothing else
    // answers true once it is done; one whose answer may be none answers it as an optional value, never as nil.
    public func answer(_ call: Call) throws -> (any Encodable & Sendable)? {
        switch call.method {
        case "record/read":
            let params = try call.params.decode(as: ReadRecordParams.self)
            return try record.read(mod: params.mod, key: params.key) as any Encodable & Sendable

        case "record/write":
            let params = try call.params.decode(as: WriteRecordParams.self)
            try record.write(mod: params.mod, key: params.key, text: params.text)
            return true

        case "record/remove":
            let params = try call.params.decode(as: RemoveRecordParams.self)
            try record.remove(mod: params.mod, key: params.key)
            return true

        case "record/keys":
            let params = try call.params.decode(as: RecordKeysParams.self)
            return try record.keys(mod: params.mod)

        case "record/count":
            let params = try call.params.decode(as: CountRecordsParams.self)
            return try record.count(mod: params.mod)

        case "state/all":
            return try state.all()

        case "state/write":
            let params = try call.params.decode(as: WriteStateParams.self)
            try state.write(folder: params.folder, key: params.key, text: params.text)
            return true

        case "setting/read":
            let params = try call.params.decode(as: ReadSettingsParams.self)
            return setting.read(mod: params.mod)

        case "setting/declare":
            let params = try call.params.decode(as: DeclareSettingsParams.self)
            return setting.declare(params.settings, mod: params.mod, run: params.run)

        case "setting/computed-choices":
            let params = try call.params.decode(as: ComputedChoicesParams.self)
            return setting.computedChoices(mod: params.mod)

        case "setting/list":
            let params = try call.params.decode(as: ListSettingsParams.self)
            return setting.list(choices: params.choices)

        case "setting/set":
            let params = try call.params.decode(as: SetSettingParams.self)
            return try setting.set(mod: params.mod, key: params.key, value: params.value, options: params.options)

        case "setting/action":
            let params = try call.params.decode(as: SettingActionParams.self)
            try setting.action(mod: params.mod, key: params.key)
            return true

        case "catalog/read":
            let mods = catalog.read()
            setting.forget()
            return mods

        case "catalog/arrange":
            let params = try call.params.decode(as: ArrangeCatalogParams.self)
            try catalog.arrange(params.ids)
            return true

        case "catalog/install-shipped":
            return try catalog.installShipped()

        case "catalog/would-install":
            let params = try call.params.decode(as: InstallModParams.self)
            return try catalog.wouldInstall(from: URL(filePath: params.from))

        case "catalog/install":
            let params = try call.params.decode(as: InstallModParams.self)
            return try catalog.install(from: URL(filePath: params.from))

        case "catalog/remove":
            let params = try call.params.decode(as: RemoveModParams.self)
            return try catalog.remove(params.id)

        case "data/count":
            let params = try call.params.decode(as: CountDataParams.self)
            return try dataFolder.count(mod: params.mod)

        case "erasure/erase":
            let params = try call.params.decode(as: ErasureParams.self)
            try erasure.erase(mod: params.mod)
            return true

        case "erasure/uncleared":
            return erasure.uncleared()

        case "erasure/cleared":
            let params = try call.params.decode(as: ErasureParams.self)
            try erasure.cleared(mod: params.mod)
            return true

        case "runner/reconcile":
            return try withChanges(runner.reconcile())

        case "runner/relaunch":
            let params = try call.params.decode(as: SandboxParams.self)
            return try withChanges(runner.relaunch(params.mod))

        case "runner/relaunch-all":
            return try withChanges(runner.relaunchAll())

        case "runner/quit":
            return try withChanges(runner.quit())

        case "runner/load":
            let params = try call.params.decode(as: SandboxParams.self)
            return try withChanges(runner.load(params.mod))

        case "runner/started":
            let params = try call.params.decode(as: StartedParams.self)
            var effects = try runner.started(
                params.mod,
                run: params.run,
                summary: params.summary,
                contributions: params.contributions
            )
            for problem in extensionRegistry.problems(of: params.mod, run: params.run) {
                effects += try runner.record(params.mod, run: params.run, problem: problem)
            }
            return withChanges(effects)

        case "runner/problem":
            let params = try call.params.decode(as: RunProblemParams.self)
            return try withChanges(runner.record(params.mod, run: params.run, problem: params.problem))

        case "runner/not-started":
            let params = try call.params.decode(as: RunProblemParams.self)
            return try withChanges(runner.notStarted(params.mod, run: params.run, problem: params.problem))

        case "runner/crash":
            let params = try call.params.decode(as: RunProblemParams.self)
            return try withChanges(runner.crash(params.mod, run: params.run, problem: params.problem))

        case "runner/stopped":
            let params = try call.params.decode(as: RunParams.self)
            return try withChanges(runner.stopped(params.mod, run: params.run))

        case "export/dependencies":
            let params = try call.params.decode(as: RunParams.self)
            return try exportBroker.dependencies(mod: params.mod, run: params.run)

        case "export/call":
            let params = try call.params.decode(as: CallExportParams.self)
            return try exportBroker.call(from: params.caller, run: params.run, mod: params.mod, path: params.path)

        case "extension/call":
            let params = try call.params.decode(as: CallExtensionParams.self)
            try extensionRegistry.call(
                from: params.caller,
                run: params.run,
                mod: params.mod,
                point: params.point,
                path: params.path
            )
            return true

        case "event/listen":
            let params = try call.params.decode(as: ListenParams.self)
            eventBus.listen(mod: params.mod, run: params.run, names: params.names)
            return true

        case "event/emit":
            let params = try call.params.decode(as: EmitParams.self)
            return eventBus.emit(mod: params.mod, run: params.run, name: params.name)

        default:
            return nil
        }
    }

    // MARK: - Private
    // What the runs moving to `effects` come to besides: what each is told has changed of what other mods give it.
    private func withChanges(_ effects: [Effect]) -> [Effect] {
        effects + exportBroker.changes() + extensionRegistry.changes()
    }
}
