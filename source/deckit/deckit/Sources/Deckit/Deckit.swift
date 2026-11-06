//
//  Deckit.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The platform on deck: the mods it reads and when they run, what it adds, and the deck it is on.
public final class Deckit {
    // MARK: - Property
    public let deck: Deck
    public let catalog: Catalog
    // The state deckit keeps, which a part keeps its own in beside deckit's.
    public let state: State
    public let runs: RunTable
    public let keymap: Keymap
    public let commands: CommandRegistry
    public let urlRouter: URLRouter
    public let configuration: Configuration
    // A mod at the relaunch limit loads only once its limit is reset.
    private var limit: RelaunchLimit
    private let now: () -> Date

    // MARK: - Initializer
    // `home` is deckit's folder, `ship` the folders of the mods the app ships, and `sources` folders of mods read in
    // place. A manifest is read against `api`, the mod contract the mods are run with, and `permissions`, those the
    // layers the driver runs define; deckit adds those it checks itself. `schemeHandlers` is, by scheme, the mods the
    // app asks first to open an address. `limit` is how often a mod's runs may fail, `now` the time a run fails at.
    public init(
        home: URL,
        ship: [URL],
        sources: [URL],
        api: Version,
        schemeHandlers: [String: [String]],
        permissions: [Permission],
        limit: RelaunchLimit = RelaunchLimit(burst: 5, interval: 10),
        now: @escaping () -> Date = Date.init
    ) throws {
        let store = Store()
        let deck = Deck(home: home)
        let urls = URLsField()
        let own = [Keymap.appKeysPermission, Keymap.globalKeysPermission]
        let reader = try ManifestReader(api: api, permissions: permissions + own, fields: [urls], store: store)
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods", directoryHint: .isDirectory)
        let settings = home.appending(path: "deck.json")
        let catalog = Catalog(
            folder: folder,
            sources: sources,
            ship: ship,
            modFolder: modFolder,
            dataFolder: deck.dataFolder,
            installer: Installer(home: home, folder: folder, ship: ship, modFolder: modFolder, store: store),
            order: Order(file: settings, store: store),
            ownerTable: deck.owners,
            startupList: StartupList(file: settings, store: store),
            store: store
        )
        let state = State(root: home.appending(path: "state", directoryHint: .isDirectory), store: store)
        let runs = RunTable(deck: deck)
        self.deck = deck
        self.catalog = catalog
        self.state = state
        self.runs = runs
        self.commands = CommandRegistry(catalog: catalog, state: state, runs: runs)
        self.keymap = Keymap(catalog: catalog, state: state, runs: runs)
        self.urlRouter = URLRouter(
            catalog: catalog,
            state: state,
            runs: runs,
            field: urls,
            schemeHandlers: schemeHandlers
        )
        self.configuration = try Configuration(catalog: catalog, modState: deck.modState)
        self.limit = limit
        self.now = now
    }

    // MARK: - Public
    // The provider of `id`: a host that declared a command or registered a key, or a mod deck loads. Nil for neither.
    public func provider(of id: String) -> Provider? {
        if let host = (commands.hosts + keymap.hosts).first(where: { host in host.id == id }) { return host }
        guard let mod = catalog.loading.first(where: { mod in mod.manifest.id == id }) else { return nil }

        return .mod(id: mod.manifest.id, name: mod.manifest.name)
    }

    // What the mods that load declare to `interface`, for its owner `owner`: an entry that names a command its mod
    // declares comes with a token of it `owner` holds as the owner, minted once for each owner and entry, and one that
    // names no command its mod declares, or one its args do not fit, is left out (CommandRegistry tells why as its mod
    // is read). Refused for a mod that does not own `interface`.
    public func contributions(to interface: String, for owner: String) throws -> [InterfaceContribution] {
        try catalog.declarations(to: interface, for: owner).compactMap { declaration in
            guard case let .object(fields) = declaration.entry else { return nil }
            let entry = JSONValue.object(fields.filter { key, _ in key != "command" && key != "args" })
            guard let named = fields["command"] else {
                return InterfaceContribution(mod: declaration.mod, name: declaration.name, entry: entry, token: nil)
            }
            guard case let .string(command) = named,
                let token = try? commands.hand(
                    command,
                    of: declaration.mod,
                    args: fields["args"],
                    to: owner,
                    for: interface
                )
            else {
                return nil
            }

            return InterfaceContribution(mod: declaration.mod, name: declaration.name, entry: entry, token: token.id)
        }
    }

    // The mods read again, as the catalog reads them now, each that loads with what deckit's parts find wrong with
    // what it declares.
    public func readCatalog() -> [Mod] {
        let mods = catalog.read { mod in
            commands.problems(of: mod) + keymap.problems(of: mod) + configuration.problems(of: mod)
        }
        commands.read(mods)
        configuration.read(mods)

        return mods
    }

    // What the runs come to once the catalog was read again.
    public func reconnect() -> [Effect] {
        deck.reconnect()
    }

    // The mods requested that load launch, as the catalog was last read and in its order. One at the relaunch limit is
    // left as it is.
    public func load(_ requests: [LaunchRequest]) throws -> [Effect] {
        let jobs = catalog.loading.compactMap { mod -> Job? in
            guard requests.contains(where: { request in request.modId == mod.manifest.id }),
                !limit.isReached(by: mod.manifest.id)
            else { return nil }
            return Job(mod)
        }

        return try observed(deck.load(jobs))
    }

    // What each mod named failed before is forgotten, which takes it off the relaunch limit.
    public func resetLimit(_ ids: [String]) {
        for id in ids {
            limit.reset(id)
        }
    }

    // The mods named unload: a sandbox whose run has ended closes once the catalog no longer has its mod as it runs it.
    public func unload(_ ids: [String]) throws -> [Effect] {
        let ending = ids.filter { id in
            guard let run = deck.run(of: id) else { return false }
            return run.state != .notRunning || isGone(id)
        }

        return try observed(deck.unload(ending))
    }

    // The `run`th run of `id` read its entry, while it launches: `summary` is what the parts read of it, as a person
    // reads it.
    public func described(_ id: String, run number: Int, summary: JSONValue) -> [Effect] {
        guard let run = deck.run(of: id), run.number == number, run.state == .launching else { return deck.reconnect() }
        runs.describe(run, summary: summary)

        return [.keep(run)] + deck.reconnect()
    }

    // The `run`th run of `id` started, with what its page reported: `summary` as a person reads it, `contributions`
    // what deck reads and `layers` what deckit's parts read, which judge it.
    public func started(
        _ id: String,
        run number: Int,
        summary: JSONValue,
        contributions: Contribution,
        layers: [String: JSONValue]
    ) throws -> [Effect] {
        let launching = deck.run(of: id).map { run in run.number == number && run.state == .launching } ?? false
        let effects = try deck.started(id, run: number, contributions: contributions)
        guard launching else { return try observed(effects) }

        return try observed(effects + contributed(id, run: number, summary: summary, layers: layers))
    }

    // What the running `run`th run of `id` contributes now, with what its page reported.
    public func joined(
        _ id: String,
        run number: Int,
        summary: JSONValue,
        contributions: Contribution,
        layers: [String: JSONValue]
    ) throws -> [Effect] {
        let effects = try deck.joined(id, run: number, contributions: contributions)

        return try observed(effects + contributed(id, run: number, summary: summary, layers: layers))
    }

    public func report(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try observed(deck.report(id, run: run, problem: problem))
    }

    public func notStarted(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try observed(deck.notStarted(id, run: run, problem: problem))
    }

    public func crashed(_ id: String, run: Int, problem: String) throws -> [Effect] {
        try observed(deck.crashed(id, run: run, problem: problem))
    }

    public func stopped(_ id: String, run: Int) throws -> [Effect] {
        try observed(deck.stopped(id, run: run))
    }

    // MARK: - Private
    // What the running `number`th run of `id` contributes for the parts is kept, and what each part finds wrong with
    // it recorded against it.
    private func contributed(
        _ id: String,
        run number: Int,
        summary: JSONValue,
        layers: [String: JSONValue]
    ) throws -> [Effect] {
        guard let run = deck.run(of: id), run.number == number, run.state == .running,
            let mod = catalog.loading.first(where: { mod in mod.manifest.id == id })
        else { return [] }
        runs.contribute(run, summary: summary, contributions: layers)

        var effects: [Effect] = []
        let problems = commands.problems(of: layers, mod: mod)
            + keymap.problems(of: layers, mod: mod)
            + urlRouter.problems(of: layers, mod: mod)
        for problem in problems {
            effects += try deck.report(id, run: number, problem: problem)
        }

        return effects
    }

    // What deckit keeps of the runs as `effects` move them: a run that launches has an entry, a run that failed counts
    // toward its mod's relaunch limit, and a sandbox closes once its run has ended and the catalog no longer has its
    // mod as it runs it.
    private func observed(_ effects: [Effect]) throws -> [Effect] {
        var closing: [String] = []
        for case let .tell(notification, run) in effects {
            switch notification {
            case .willLaunch:
                runs.begin(run)

            case .didTerminate:
                if run.failed, limit.fail(run.modId, at: now()) {
                    runs.limitRelaunch(run)
                }
                if isGone(run.modId) {
                    closing.append(run.modId)
                }

            case .didLaunch, .didFailToLaunch, .willTerminate:
                break
            }
        }
        guard !closing.isEmpty else { return effects }

        return try effects + deck.unload(closing)
    }

    // Whether the catalog, as it was last read, no longer has the mod as its sandbox runs it.
    private func isGone(_ id: String) -> Bool {
        guard let job = deck.job(of: id) else { return true }

        return !catalog.loading.contains { mod in mod.manifest.id == id && mod.revision == job.revision }
    }
}
