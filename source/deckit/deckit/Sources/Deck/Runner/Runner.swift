//
//  Runner.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Every mod that loads, as the catalog was last read, runs in a sandbox of its own, and runs only while what it
// requires runs. The driver says what happened to a run, and is answered what to do, in order: the runner never waits
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

    // The mod's latest run, while it has a sandbox.
    func run(of id: String) -> Run? {
        sandbox(of: id)?.run
    }

    // A mod runs as it arrives and goes as it leaves; one whose code changed goes and runs again, once its old sandbox
    // has closed. Nothing opens while the app quits.
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
            if let missing = notRunningRequirement(of: sandbox) {
                throw RunnerError.needs(mod: id, requirement: missing)
            }
            try relaunch(sandbox)
        }
    }

    // The app quits once every run has ended, and nothing launches until then.
    func quit() throws -> [Effect] {
        try decide {
            quitting = true
            for sandbox in sandboxes {
                try terminate(sandbox, .quit)
            }
        }
    }

    // A page that loaded again by itself runs again: the run it had ended with the document it ran in.
    func load(_ id: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id) else { throw RunnerError.noSandbox(id) }
            guard sandbox.closing == nil else { throw RunnerError.closing(id) }
            guard sandbox.run.state != .launching else { return }
            guard !quitting else { throw RunnerError.quitting(id) }
            if let missing = notRunningRequirement(of: sandbox) {
                throw RunnerError.needs(mod: id, requirement: missing)
            }

            if sandbox.run.state != .notRunning {
                try move(sandbox) { run throws(LifecycleError) in try run.crash("its page loaded again") }
            }
            try launch(sandbox)
        }
    }

    // It started, with what it contributed.
    func started(_ id: String, run number: Int, summary: JSONValue, contributions: Contribution) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.run.state == .launching else { return }
            try move(sandbox) { run throws(LifecycleError) in
                try run.didLaunch(summary: summary, contributions: contributions)
            }
        }
    }

    func record(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number) else { return }
            sandbox.run.record(problem)
            effects.append(.keep(sandbox.run))
        }
    }

    // It did not start, and why: its stop() is asked as it terminates.
    func notStarted(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.run.state == .launching else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.didFailToLaunch(problem) }
        }
    }

    func crash(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.run.state != .notRunning else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.crash(problem) }
        }
    }

    // Its stop() answered, its time ran out or its page is gone.
    func stopped(_ id: String, run number: Int) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.run.state == .terminating else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.didTerminate() }
        }
    }

    // MARK: - Private
    // What one fact comes to. A terminating run's stop() is asked once every mod that requires it has ended, and a
    // quit goes on once every run has.
    private func decide(_ fact: () throws -> Void) throws -> [Effect] {
        effects = []
        try fact()
        askStops()
        if quitting && sandboxes.allSatisfy({ sandbox in sandbox.run.state == .notRunning }) {
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
        try tell(.willLaunch, sandbox)
        effects.append(.load(modId: mod.manifest.id))
    }

    // What runs in its place opens once it has closed.
    private func close(_ sandbox: Sandbox, _ reason: TerminateReason) throws {
        sandbox.closing = reason
        effects.append(.closing(modId: sandbox.mod.manifest.id))
        try terminate(sandbox, reason)
        if sandbox.run.state == .notRunning {
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

    // The run terminates to relaunch, and the mod launches again once it has ended, unless the run was given a
    // stronger reason meanwhile. One ended before launches again now.
    private func relaunch(_ sandbox: Sandbox) throws {
        if sandbox.run.state == .notRunning {
            try launchAgain(sandbox)
        } else {
            try terminate(sandbox, .relaunch)
        }
    }

    // While a mod it requires is neither launching nor running, it waits to launch with that one.
    private func launchAgain(_ sandbox: Sandbox) throws {
        guard notRunningRequirement(of: sandbox) == nil else { return }
        try launch(sandbox)
        effects.append(.load(modId: sandbox.mod.manifest.id))
    }

    private func launch(_ sandbox: Sandbox) throws {
        sandbox.run = nextRun(of: sandbox.mod.manifest.id)
        sandbox.stopAsked = false
        try tell(.willLaunch, sandbox)
    }

    private func terminate(_ sandbox: Sandbox, _ reason: TerminateReason) throws {
        guard sandbox.run.state != .notRunning else { return }
        try move(sandbox) { run throws(LifecycleError) in try run.terminate(reason) }
    }

    private func move(
        _ sandbox: Sandbox,
        _ step: (inout Run) throws(LifecycleError) -> LifecycleNotification?
    ) throws {
        guard let notification = try step(&sandbox.run) else { return }
        try tell(notification, sandbox)
    }

    // A mod runs only while what it requires runs: it terminates as one of them ends, before that one's stop() is
    // asked, and launches again as one of them launches, or as it ends when they run again by then. A run that crashed
    // or did not launch ends with no willTerminate.
    private func tell(_ notification: LifecycleNotification, _ sandbox: Sandbox) throws {
        effects.append(.tell(notification, sandbox.run))
        let id = sandbox.mod.manifest.id
        switch notification {
        case .willLaunch:
            for dependent in dependents(of: id)
            where dependent.run.state == .notRunning && dependent.closing == nil && !quitting {
                try launchAgain(dependent)
            }

        case .willTerminate:
            try terminateDependents(of: id)

        case .didTerminate:
            try ended(sandbox)

        case .didLaunch, .didFailToLaunch:
            break
        }
    }

    private func ended(_ sandbox: Sandbox) throws {
        if sandbox.run.endReason == nil {
            try terminateDependents(of: sandbox.mod.manifest.id)
        }
        if sandbox.closing != nil {
            try closed(sandbox)
        } else if (sandbox.run.relaunches || sandbox.run.endReason == .requirement) && !quitting {
            try launchAgain(sandbox)
        }
    }

    private func terminateDependents(of id: String) throws {
        for dependent in dependents(of: id) where dependent.closing == nil {
            try terminate(dependent, .requirement)
        }
    }

    private func askStops() {
        for sandbox in sandboxes where sandbox.run.state == .terminating && !sandbox.stopAsked {
            let waiting = dependents(of: sandbox.mod.manifest.id).contains { dependent in
                dependent.run.state == .terminating
            }
            guard !waiting else { continue }
            sandbox.stopAsked = true
            effects.append(.stop(modId: sandbox.mod.manifest.id, number: sandbox.run.number))
        }
    }

    private func nextRun(of id: String) -> Run {
        let number = runNumbers[id, default: 0] + 1
        runNumbers[id] = number

        return Run(modId: id, number: number)
    }

    private func dependents(of id: String) -> [Sandbox] {
        sandboxes.filter { sandbox in sandbox.mod.manifest.requires[id] != nil }
    }

    // The id of a mod it requires whose run is neither launching nor running, or nil.
    private func notRunningRequirement(of sandbox: Sandbox) -> String? {
        sandbox.mod.manifest.requires.keys.sorted().first { id in
            let state = self.sandbox(of: id)?.run.state
            return state != .launching && state != .running
        }
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
