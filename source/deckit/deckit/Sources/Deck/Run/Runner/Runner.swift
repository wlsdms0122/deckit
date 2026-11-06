//
//  Runner.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Each mod loads in a sandbox of its own and runs only while what it requires runs: one loaded while a mod it requires
// does not run fails as it launches and stays as it is, and one ends before what it requires does. Which mods load or
// unload, and when, is the caller's, but for a mod at the relaunch limit, which loads only once its limit is reset.
// The driver says what happened to a run, and is answered what to do, in order: the runner never waits on it, and what
// comes of an effect comes back as what happened next.
final class Runner {
    // MARK: - Property
    private let catalog: Catalog
    // In the order they opened.
    private var sandboxes: [Sandbox] = []
    // Mod id -> the number of its latest run, counted from 1.
    private var runNumbers: [String: Int] = [:]
    private var effects: [Effect] = []
    private var limit: RelaunchLimit
    private let now: () -> Date

    // MARK: - Initializer
    // `limit` is how often a mod's runs may fail, `now` the time a run fails at.
    init(
        catalog: Catalog,
        limit: RelaunchLimit = RelaunchLimit(burst: 5, interval: 10),
        now: @escaping () -> Date = Date.init
    ) {
        self.catalog = catalog
        self.limit = limit
        self.now = now
    }

    // MARK: - Public
    // The mods that have a sandbox, in the order they opened.
    func mods() -> [Mod] {
        sandboxes.map(\.mod)
    }

    // The mod a sandbox runs, while it has one.
    func mod(of id: String) -> Mod? {
        sandbox(of: id)?.mod
    }

    // The mod's latest run.
    func run(of id: String) -> Run? {
        sandbox(of: id)?.run
    }

    // The id of the owner of `interface`, as the catalog was last read.
    func owner(of interface: String) -> String? {
        catalog.owner(of: interface)
    }

    // Interface -> its owner, as the catalog was last read.
    func owners() -> [String: String] {
        catalog.owners
    }

    // Each mod requested that loads, as the catalog was last read, launches in the mods' order, in its page loaded
    // anew, its run keeping the request's origin. One whose run has not ended is left as it is, and one at the relaunch
    // limit too. One whose code changed since its sandbox opened launches in a new sandbox.
    func load(_ requests: [LaunchRequest]) throws -> [Effect] {
        try decide {
            for mod in catalog.lastRead where mod.problem == nil {
                let id = mod.manifest.id
                guard let request = requests.first(where: { request in request.modId == id }) else { continue }
                let sandbox = sandbox(of: id)
                guard (sandbox?.state ?? .notRunning) == .notRunning, !limit.isReached(by: id) else { continue }

                let run = nextRun(of: id, origin: request.origin)
                if let sandbox, sandbox.mod.revision == mod.revision {
                    sandbox.run = run
                    try launch(sandbox)
                } else {
                    if let sandbox {
                        close(sandbox)
                    }
                    try open(mod, run: run)
                }
            }
        }
    }

    // What each mod named failed before is forgotten, which takes it off the relaunch limit.
    func resetLimit(_ ids: [String]) {
        for id in ids {
            limit.reset(id)
        }
    }

    // Each mod named whose run has not ended terminates, after the mods that require it. A sandbox closes
    // once its run has ended and the catalog no longer has its mod as it runs it.
    func unload(_ ids: [String]) throws -> [Effect] {
        try decide {
            for sandbox in sandboxes where ids.contains(sandbox.mod.manifest.id) {
                if sandbox.state == .notRunning {
                    closeIfGone(sandbox)
                } else {
                    try terminate(sandbox)
                }
            }
        }
    }

    // It read its entry, while it launches.
    func described(_ id: String, run number: Int, summary: JSONValue) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .launching else { return }
            var run = sandbox.run
            run.describe(summary)
            sandbox.run = run
            effects.append(.keep(run))
        }
    }

    // It started, with what it contributed.
    func started(_ id: String, run number: Int, summary: JSONValue, contributions: Contribution) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .launching else { return }
            try move(sandbox) { run throws(LifecycleError) in
                try run.didLaunch(summary: summary, contributions: contributions)
            }
        }
    }

    // What it contributes now, while it runs.
    func joined(_ id: String, run number: Int, summary: JSONValue, contributions: Contribution) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .running else { return }
            var run = sandbox.run
            run.join(summary: summary, contributions: contributions)
            sandbox.run = run
            effects.append(.keep(run))
        }
    }

    func report(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number) else { return }
            var run = sandbox.run
            guard run.record(problem) else { return }
            sandbox.run = run
            effects.append(.keep(run))
        }
    }

    // It did not start, and why: its end is asked of its page as it terminates.
    func notStarted(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .launching else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.didFailToLaunch(problem) }
        }
    }

    func crashed(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state != .notRunning else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.crash(problem) }
        }
    }

    // Its page ended it, its time ran out or its page is gone.
    func stopped(_ id: String, run number: Int) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .terminating else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.didTerminate() }
        }
    }

    // MARK: - Private
    // What one fact comes to. A terminating run's end is asked once every mod that requires it has ended.
    private func decide(_ fact: () throws -> Void) throws -> [Effect] {
        effects = []
        try fact()
        askStops()

        return effects
    }

    private func open(_ mod: Mod, run: Run) throws {
        let sandbox = Sandbox(mod: mod, run: run)
        sandboxes.append(sandbox)
        effects.append(.open(mod))
        try launch(sandbox)
    }

    private func closeIfGone(_ sandbox: Sandbox) {
        let current = catalog.lastRead.contains { mod in
            mod.manifest.id == sandbox.mod.manifest.id && mod.problem == nil && mod.revision == sandbox.mod.revision
        }
        if !current {
            close(sandbox)
        }
    }

    private func close(_ sandbox: Sandbox) {
        sandboxes.removeAll { other in other === sandbox }
        effects.append(.close(modId: sandbox.mod.manifest.id))
    }

    // Its latest run launches. While a mod it requires does not run, the run fails as it launches, and its page does
    // not load. One that requires a mod at the relaunch limit ends with that mod, no failure of its own.
    private func launch(_ sandbox: Sandbox) throws {
        sandbox.stopAsked = false
        try tell(.willLaunch, sandbox.run, of: sandbox)
        if let missing = missing(sandbox) {
            let limited = limit.isReached(by: missing)
            try move(sandbox) { run throws(LifecycleError) in
                limited
                    ? try run.crash("needs \(missing), which reached the relaunch limit", with: missing)
                    : try run.crash("needs \(missing), which was not running")
            }
        } else {
            effects.append(.loadPage(modId: sandbox.mod.manifest.id))
        }
    }

    private func terminate(_ sandbox: Sandbox, with required: String? = nil) throws {
        try move(sandbox) { run throws(LifecycleError) in try run.terminate(with: required) }
    }

    // A run that ends failing counts toward its mod's relaunch limit.
    private func move(
        _ sandbox: Sandbox,
        _ step: (inout Run) throws(LifecycleError) -> LifecycleNotification?
    ) throws {
        var run = sandbox.run
        let notification = try step(&run)
        if notification == .didTerminate, run.failed, limit.fail(run.modId, at: now()) {
            run.limitRelaunch()
        }
        sandbox.run = run
        guard let notification else { return }
        try tell(notification, run, of: sandbox)
    }

    // A mod runs only while what it requires runs: it terminates as one of them terminates, before that one's end is
    // asked, or as one ends with no willTerminate, having crashed or not launched.
    private func tell(_ notification: LifecycleNotification, _ run: Run, of sandbox: Sandbox) throws {
        effects.append(.tell(notification, run))
        switch notification {
        case .willTerminate:
            try terminateDependents(of: sandbox.mod.manifest.id)

        case .didTerminate:
            try terminateDependents(of: sandbox.mod.manifest.id)
            closeIfGone(sandbox)

        case .willLaunch, .didLaunch, .didFailToLaunch:
            break
        }
    }

    private func terminateDependents(of id: String) throws {
        for dependent in directDependents(of: id) {
            try terminate(dependent, with: id)
        }
    }

    private func askStops() {
        for sandbox in sandboxes {
            let run = sandbox.run
            guard run.state == .terminating, !sandbox.stopAsked else { continue }
            let dependentEnding = directDependents(of: sandbox.mod.manifest.id).contains { dependent in
                dependent.state == .terminating
            }
            guard !dependentEnding else { continue }
            sandbox.stopAsked = true
            effects.append(.stop(modId: sandbox.mod.manifest.id, number: run.number))
        }
    }

    private func nextRun(of id: String, origin: LaunchOrigin) -> Run {
        let number = runNumbers[id, default: 0] + 1
        runNumbers[id] = number

        return Run(modId: id, number: number, origin: origin)
    }

    private func directDependents(of id: String) -> [Sandbox] {
        sandboxes.filter { sandbox in sandbox.mod.manifest.required.contains(id) }
    }

    // The first mod it requires, by id, that does not run, or nil.
    private func missing(_ sandbox: Sandbox) -> String? {
        sandbox.mod.manifest.required.first { id in self.sandbox(of: id)?.state != .running }
    }

    private func sandbox(of id: String) -> Sandbox? {
        sandboxes.first { sandbox in sandbox.mod.manifest.id == id }
    }

    // The mod's sandbox, while its latest run is the `number`th: what an older run said, still on its way, is not the
    // newer one's.
    private func sandbox(of id: String, run number: Int) -> Sandbox? {
        guard let sandbox = sandbox(of: id), sandbox.run.number == number else { return nil }
        return sandbox
    }
}
