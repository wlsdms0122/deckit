//
//  Runner.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Every mod that loads, as the catalog was last read, runs in a sandbox of its own, and runs only while what it
// requires runs: one that launches while a mod it requires is neither launching nor running fails as it launches, and
// stays as it is. The driver says what happened to a run, and is answered what to do, in order: the runner never waits
// on it, and what comes of an effect comes back as what happened next.
final class Runner {
    // MARK: - Property
    private let catalog: Catalog
    // In the order they opened.
    private var sandboxes: [Sandbox] = []
    // Mod id -> the number of its latest run, counted from 1.
    private var runNumbers: [String: Int] = [:]
    private var quitting = false
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

    // A mod opens as it arrives and goes as it leaves; one whose code changed goes and opens again, once its old
    // sandbox has closed. Nothing opens while the app quits.
    func reconcile() throws -> [Effect] {
        try decide {
            try match(catalog.lastRead.filter { mod in mod.problem == nil })
        }
    }

    // Every mod terminates and launches again, and a mod whose run ended for a quit the host app called off launches
    // again.
    func relaunchAll() throws -> [Effect] {
        try decide {
            guard !quitting else { return }
            for sandbox in sandboxes where sandbox.closing == nil {
                try relaunch(sandbox)
            }
            try match(catalog.lastRead.filter { mod in mod.problem == nil })
        }
    }

    // The mod terminates and launches again, or launches when it is not running.
    func relaunch(_ id: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id), sandbox.closing == nil, !quitting else { return }
            try relaunch(sandbox)
        }
    }

    // The mods that require it, directly or through another, and are not running launch, in the load order.
    func launchDependents(of id: String) throws -> [Effect] {
        try decide {
            guard !quitting, let mod = catalog.lastRead.first(where: { mod in mod.manifest.id == id }) else { return }
            for sandbox in inLoadOrder()
            where mod.dependents.contains(sandbox.mod.manifest.id) && sandbox.closing == nil
                && sandbox.state == .notRunning {
                try load(sandbox)
            }
        }
    }

    // The app quits once every run has ended, and nothing launches until then.
    func quit() throws -> [Effect] {
        try decide {
            quitting = true
            for sandbox in sandboxes {
                sandbox.relaunching = false
                try terminate(sandbox, .quit)
            }
        }
    }

    // A page that loaded again by itself runs again: the run it had ended with the document it ran in.
    func loaded(_ id: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id) else { throw RunnerError.noSandbox(id) }
            guard sandbox.closing == nil else { throw RunnerError.closing(id) }
            guard sandbox.state != .launching else { return }
            guard !quitting else { throw RunnerError.quitting(id) }

            if sandbox.state != .notRunning {
                try move(sandbox) { run throws(LifecycleError) in try run.crash("its page loaded again") }
            }
            sandbox.run = nextRun(of: id)
            try launch(sandbox, loadingPage: false)
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
    // What one fact comes to. A terminating run's stop() is asked once every mod that requires it has ended, the mods
    // asked to launch again do once none of them terminates, and a quit goes on once every run has ended.
    private func decide(_ fact: () throws -> Void) throws -> [Effect] {
        effects = []
        try fact()
        try launchRelaunching()
        askStops()
        if quitting && sandboxes.allSatisfy({ sandbox in sandbox.state == .notRunning }) {
            quitting = false
            effects.append(.quit)
        }

        return effects
    }

    private func match(_ mods: [Mod]) throws {
        for sandbox in sandboxes where sandbox.closing == nil {
            let found = mods.first { mod in mod.manifest.id == sandbox.mod.manifest.id }
            if found?.revision != sandbox.mod.revision {
                try close(sandbox, found == nil ? .removed : .updated)
            }
        }
        guard !quitting else { return }
        for mod in mods where sandbox(of: mod.manifest.id) == nil {
            try open(mod)
        }
    }

    private func open(_ mod: Mod) throws {
        let sandbox = Sandbox(mod: mod, run: nextRun(of: mod.manifest.id))
        sandboxes.append(sandbox)
        effects.append(.open(mod))
        try launch(sandbox, loadingPage: true)
    }

    // What runs in its place opens once it has closed.
    private func close(_ sandbox: Sandbox, _ reason: TerminateReason) throws {
        sandbox.closing = reason
        effects.append(.closing(modId: sandbox.mod.manifest.id))
        try terminate(sandbox, reason)
        if sandbox.state == .notRunning {
            try closed(sandbox)
        }
    }

    private func closed(_ sandbox: Sandbox) throws {
        guard let reason = sandbox.closing else { return }
        let id = sandbox.mod.manifest.id
        sandboxes.removeAll { other in other === sandbox }
        effects.append(.close(modId: id, reason: reason))
        guard !quitting else { return }
        if let mod = catalog.lastRead.first(where: { mod in mod.manifest.id == id && mod.problem == nil }) {
            try open(mod)
        }
    }

    // The run terminates, and the mod launches again once no mod asked to launch again terminates.
    private func relaunch(_ sandbox: Sandbox) throws {
        sandbox.relaunching = true
        try terminate(sandbox, .relaunch)
    }

    // The mods asked to launch again launch, in the load order, once none of them terminates: a mod launches after
    // what it requires, which has launched again by then. One going opens again instead, and none launches while the
    // app quits.
    private func launchRelaunching() throws {
        guard !quitting, !sandboxes.contains(where: { sandbox in sandbox.relaunching && sandbox.state != .notRunning })
        else { return }

        for sandbox in inLoadOrder() where sandbox.relaunching {
            sandbox.relaunching = false
            if sandbox.closing == nil {
                try load(sandbox)
            }
        }
    }

    // The mod launches again, in its page loaded anew.
    private func load(_ sandbox: Sandbox) throws {
        sandbox.run = nextRun(of: sandbox.mod.manifest.id)
        try launch(sandbox, loadingPage: true)
    }

    // Its run launches, in its page loaded anew while `loadingPage`. While a mod it requires is neither launching nor
    // running, the run fails as it launches, and its page does not load.
    private func launch(_ sandbox: Sandbox, loadingPage: Bool) throws {
        sandbox.relaunching = false
        sandbox.stopAsked = false
        try tell(.willLaunch, sandbox.run, of: sandbox)
        if let missing = missing(sandbox) {
            try move(sandbox) { run throws(LifecycleError) in try run.crash("needs \(missing), which was not running") }
        } else if loadingPage {
            effects.append(.load(modId: sandbox.mod.manifest.id))
        }
    }

    private func terminate(_ sandbox: Sandbox, _ reason: TerminateReason) throws {
        guard sandbox.state != .notRunning else { return }
        try move(sandbox) { run throws(LifecycleError) in try run.terminate(reason) }
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

    // A mod runs only while what it requires runs: it terminates as one of them ends, before that one's stop() is
    // asked. A run that crashed or did not launch ends with no willTerminate.
    private func tell(_ notification: LifecycleNotification, _ run: Run, of sandbox: Sandbox) throws {
        effects.append(.tell(notification, run))
        switch notification {
        case .willTerminate:
            try terminateDependents(of: sandbox.mod.manifest.id)

        case .didTerminate:
            try ended(sandbox, run)

        case .willLaunch, .didLaunch, .didFailToLaunch:
            break
        }
    }

    private func ended(_ sandbox: Sandbox, _ run: Run) throws {
        if run.endReason == nil {
            try terminateDependents(of: sandbox.mod.manifest.id)
        }
        if sandbox.closing != nil {
            try closed(sandbox)
        }
    }

    private func terminateDependents(of id: String) throws {
        for dependent in directDependents(of: id) where dependent.closing == nil {
            try terminate(dependent, .requirement)
        }
    }

    private func askStops() {
        for sandbox in sandboxes {
            let run = sandbox.run
            guard run.state == .terminating, !sandbox.stopAsked else { continue }
            let waiting = directDependents(of: sandbox.mod.manifest.id).contains { dependent in
                dependent.state == .terminating
            }
            guard !waiting else { continue }
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

    // The first mod it requires, by id, whose run is neither launching nor running, or nil.
    private func missing(_ sandbox: Sandbox) -> String? {
        sandbox.mod.manifest.requires.keys.sorted().first { id in
            let state = self.sandbox(of: id)?.state
            return state != .launching && state != .running
        }
    }

    // The sandboxes in the load order, as the catalog was last read.
    private func inLoadOrder() -> [Sandbox] {
        catalog.lastRead.compactMap { mod in sandbox(of: mod.manifest.id) }
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
