//
//  ExportBroker.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod reaches another only through what that one exports, and only one it requires or has as an optional dependency.
// What a run exports is what it contributed as it started, and a call reaches it while it runs, and while it terminates
// until it has ended: the mods that require it end first.
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
    // What each mod the run requires exports, and what its optional dependencies export to it now.
    public func dependencies(mod id: String, run number: Int) throws(ExportError) -> Dependencies {
        let mod = try running(id, run: number)
        var requires: [String: Snapshot] = [:]
        for required in mod.manifest.requires.keys.sorted() {
            guard let exports = answering(required) else { throw .notRunning(required) }
            requires[required] = exports
        }
        let optional = mod.manifest.optional.keys.map { other in (other, try? usableExports(of: other, by: mod)) }

        return Dependencies(requires: requires, optional: Dictionary(uniqueKeysWithValues: optional))
    }

    // Whether a call from the `number`th run of `caller` into the function at `path` of what `id` exports goes to that
    // mod's page. A mod it has optional answers only while it runs.
    public func call(from caller: String, run number: Int, mod id: String, path: [String]) throws(ExportError) {
        let callerMod = try running(caller, run: number)
        let exports: Snapshot
        if callerMod.manifest.optional[id] != nil {
            exports = try usableExports(of: id, by: callerMod)
        } else if callerMod.manifest.requires[id] != nil {
            guard let answering = answering(id) else { throw .notRunning(id) }
            exports = answering
        } else {
            throw .notADependency(mod: id, of: caller)
        }
        guard exports.functions.contains(path) else { throw .noSuchFunction(mod: id, path: path) }
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
    // The mod, while its latest run is the `number`th and has not ended.
    private func running(_ id: String, run number: Int) throws(ExportError) -> Mod {
        guard let mod = runner.mod(of: id),
            let run = runner.run(of: id),
            run.number == number,
            run.state != .notRunning
        else { throw .notRunning(id) }

        return mod
    }

    // A run that launched answers calls until it has ended.
    private func answering(_ id: String) -> Snapshot? {
        guard let run = runner.run(of: id), run.state == .running || run.state == .terminating else { return nil }
        return run.contributions?.exports
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
