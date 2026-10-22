//
//  ExportBroker.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod reaches another only through what that one exports, and only one it requires or has as an optional dependency.
// What a run exports is what it contributed as it started, and a call reaches it while it runs, and while it terminates
// until it has ended: the mods that require it end first. What a run has not decided yet is answered pending on it.
public final class ExportBroker {
    // MARK: - Property
    private let runner: Runner
    // Mod id -> its run last told what its optional dependencies export to it, and the run of each it may use, as told.
    private var told: [String: (run: Int, providers: [String: Int])] = [:]

    // MARK: - Initializer
    init(runner: Runner) {
        self.runner = runner
    }

    // MARK: - Public
    // What each mod the run requires exports, once each has started, and what its optional dependencies export to it
    // now. Refused once one it requires has ended for good.
    public func dependencies(mod id: String, run number: Int) throws(ExportError) -> Poll<Dependencies> {
        let (mod, _) = try running(id, run: number)
        var requires: [String: Snapshot] = [:]
        for required in mod.manifest.requires.keys.sorted() {
            switch provision(of: required) {
            case let .ready(exports):
                requires[required] = exports

            case let .pending(pending):
                return .pending(pending)

            case let .ended(problem):
                throw .needs(required, problem: problem)
            }
        }
        let optional = mod.manifest.optional.keys.map { other in (other, try? usableExports(of: other, by: mod)) }

        return .ready(Dependencies(requires: requires, optional: Dictionary(uniqueKeysWithValues: optional)))
    }

    // A call from the `number`th run of `caller` into the function at `path` of what `id` exports: ready once it goes
    // to that mod's page. A mod it requires that launches again answers a running caller once its new run has started,
    // and a terminating caller only with the run it ran with. A mod it has optional answers only while it runs.
    public func call(
        from caller: String,
        run number: Int,
        mod id: String,
        path: [String]
    ) throws(ExportError) -> Poll<Bool> {
        let (callerMod, run) = try running(caller, run: number)
        let exports: Snapshot
        if callerMod.manifest.optional[id] != nil {
            exports = try usableExports(of: id, by: callerMod)
        } else if callerMod.manifest.requires[id] != nil {
            if let answering = answering(id) {
                exports = answering
            } else {
                guard run.state != .terminating else { throw .notRunning(id) }
                switch provision(of: id) {
                case let .ready(provided):
                    exports = provided

                case let .pending(pending):
                    return .pending(pending)

                case let .ended(problem):
                    throw .ended(id, problem: problem)
                }
            }
        } else {
            throw .notADependency(mod: id, of: caller)
        }
        guard exports.functions.contains(path) else { throw .noSuchFunction(mod: id, path: path) }

        return .ready(true)
    }

    // What each run with optional dependencies has not been told yet: what one of them exports to it now, or that it
    // exports nothing. A run new since asks what they export as it launches, and is told what changes after.
    func changes() -> [Effect] {
        var effects: [Effect] = []
        var now: [String: (run: Int, providers: [String: Int])] = [:]
        for mod in runner.mods() where !mod.manifest.optional.isEmpty {
            let id = mod.manifest.id
            guard let run = runner.run(of: id), run.state != .notRunning else { continue }

            var providers: [String: Int] = [:]
            for other in mod.manifest.optional.keys where (try? usableExports(of: other, by: mod)) != nil {
                providers[other] = runner.run(of: other)?.number
            }
            if let before = told[id], before.run == run.number {
                for other in mod.manifest.optional.keys.sorted() where before.providers[other] != providers[other] {
                    let exports = try? usableExports(of: other, by: mod)
                    effects.append(.optionalChanged(modId: id, dependency: other, exports: exports))
                }
            }
            now[id] = (run.number, providers)
        }
        told = now

        return effects
    }

    // MARK: - Private
    // The mod and its run, while its latest run is the `number`th and has not ended.
    private func running(_ id: String, run number: Int) throws(ExportError) -> (Mod, Run) {
        guard let mod = runner.mod(of: id),
            let run = runner.run(of: id),
            run.number == number,
            run.state != .notRunning
        else { throw .notRunning(id) }

        return (mod, run)
    }

    // A run that launched answers calls until it has ended.
    private func answering(_ id: String) -> Snapshot? {
        guard let run = runner.run(of: id), run.state == .running || run.state == .terminating else { return nil }
        return run.contributions?.exports
    }

    // What a mod it requires gives the mods that depend on it: what it exports while it runs. A run terminating for a
    // reason may launch again, so what depends on it waits until it has ended; one that did not launch has failed.
    private func provision(of id: String) -> Provision {
        guard let run = runner.run(of: id) else { return .ended("it has no sandbox") }
        let pending = Provision.pending(Pending(mod: id, run: run.number, state: run.state))
        switch run.state {
        case .launching:
            return pending

        case .running:
            return run.contributions.map { contributions in .ready(contributions.exports) } ?? pending

        case .terminating:
            return run.endReason == nil ? .ended(problem(of: run)) : pending

        case .notRunning:
            return run.relaunches ? pending : .ended(problem(of: run))
        }
    }

    private func problem(of run: Run) -> String {
        run.problem ?? run.endReason?.rawValue ?? "it ended"
    }

    // Running, not yet ending, at a version `mod` names: one that starts ending is gone to it at once, as a mod that
    // requires it would have ended first.
    private func usableExports(of id: String, by mod: Mod) throws(ExportError) -> Snapshot {
        guard let run = runner.run(of: id),
            run.state == .running,
            let exports = run.contributions?.exports,
            let provider = runner.mod(of: id)
        else { throw .notRunning(id) }
        guard mod.manifest.takesOptional(provider.manifest) else {
            throw .otherVersion(
                mod: id,
                version: provider.manifest.version ?? "of no version",
                dependent: mod.manifest.id,
                wanted: mod.manifest.optional[id] ?? ""
            )
        }

        return exports
    }
}
