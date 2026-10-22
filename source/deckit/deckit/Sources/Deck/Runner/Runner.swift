//
//  Runner.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Each mod loads in a sandbox of its own and runs only while what it requires runs: one loaded while a mod it requires
// does not run fails as it launches and stays as it is, and one ends before what it requires does. Which mods load or
// unload, and when, is the caller's. The driver says what happened to a run, and is answered what to do, in order: the
// runner never waits on it, and what comes of an effect comes back as what happened next.
final class Runner {
    // MARK: - Property
    private let catalog: Catalog
    // In the order they opened.
    private var sandboxes: [Sandbox] = []
    // Mod id -> the number of its latest run, counted from 1.
    private var runNumbers: [String: Int] = [:]
    private var effects: [Effect] = []

    // MARK: - Initializer
    init(catalog: Catalog) {
        self.catalog = catalog
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

    // Each mod named that loads, as the catalog was last read, launches in the load order, in its page loaded anew.
    // One whose run has not ended is left as it is. One whose code changed since its sandbox opened launches in a new
    // sandbox.
    func load(_ ids: [String]) throws -> [Effect] {
        try decide {
            for mod in catalog.lastRead where mod.problem == nil && ids.contains(mod.manifest.id) {
                let sandbox = sandbox(of: mod.manifest.id)
                guard (sandbox?.state ?? .notRunning) == .notRunning else { continue }

                if let sandbox, sandbox.mod.revision == mod.revision {
                    sandbox.run = nextRun(of: mod.manifest.id)
                    try launch(sandbox)
                } else {
                    if let sandbox {
                        close(sandbox)
                    }
                    try open(mod)
                }
            }
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

    // It started, with what it contributed.
    func started(_ id: String, run number: Int, summary: JSONValue, contributions: Contribution) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .launching else { return }
            try move(sandbox) { run throws(LifecycleError) in
                try run.didLaunch(summary: summary, contributions: contributions)
            }
        }
    }

    func report(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number) else { return }
            var run = sandbox.run
            run.record(problem)
            sandbox.run = run
            effects.append(.keep(run))
        }
    }

    // It did not start, and why: its stop() is asked as it terminates.
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

    // Its stop() answered, its time ran out or its page is gone.
    func stopped(_ id: String, run number: Int) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .terminating else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.didTerminate() }
        }
    }

    // MARK: - Private
    // What one fact comes to. A terminating run's stop() is asked once every mod that requires it has ended.
    private func decide(_ fact: () throws -> Void) throws -> [Effect] {
        effects = []
        try fact()
        askStops()

        return effects
    }

    private func open(_ mod: Mod) throws {
        let sandbox = Sandbox(mod: mod, run: nextRun(of: mod.manifest.id))
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
    // not load.
    private func launch(_ sandbox: Sandbox) throws {
        sandbox.stopAsked = false
        try tell(.willLaunch, sandbox.run, of: sandbox)
        if let missing = missing(sandbox) {
            try move(sandbox) { run throws(LifecycleError) in try run.crash("needs \(missing), which was not running") }
        } else {
            effects.append(.loadPage(modId: sandbox.mod.manifest.id))
        }
    }

    private func terminate(_ sandbox: Sandbox) throws {
        guard sandbox.state != .notRunning else { return }
        try move(sandbox) { run throws(LifecycleError) in try run.terminate() }
    }

    private func move(
        _ sandbox: Sandbox,
        _ step: (inout Run) throws(LifecycleError) -> LifecycleNotification?
    ) throws {
        var run = sandbox.run
        let notification = try step(&run)
        sandbox.run = run
        guard let notification else { return }
        try tell(notification, run, of: sandbox)
    }

    // A mod runs only while what it requires runs: it terminates as one of them terminates, before that one's stop()
    // is asked, or as one ends with no willTerminate, having crashed or not launched.
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
            try terminate(dependent)
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

    private func nextRun(of id: String) -> Run {
        let number = runNumbers[id, default: 0] + 1
        runNumbers[id] = number

        return Run(modId: id, number: number)
    }

    private func directDependents(of id: String) -> [Sandbox] {
        sandboxes.filter { sandbox in sandbox.mod.manifest.requires[id] != nil }
    }

    // The first mod it requires, by id, that does not run, or nil.
    private func missing(_ sandbox: Sandbox) -> String? {
        sandbox.mod.manifest.requires.keys.sorted().first { id in self.sandbox(of: id)?.state != .running }
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
