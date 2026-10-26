//
//  ExportBroker.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod reaches another only through what that one exports, and only one it requires. What a run exports is what it
// contributed as it started, and a call reaches it while it runs, and while it terminates until it has ended: the mods
// that require it end first.
public final class ExportBroker {
    // MARK: - Property
    private let runner: Runner

    // MARK: - Initializer
    init(runner: Runner) {
        self.runner = runner
    }

    // MARK: - Public
    // What each mod the run requires exports, by its id.
    public func requires(mod id: String, run number: Int) throws(ExportError) -> [String: Snapshot] {
        let mod = try running(id, run: number)
        var requires: [String: Snapshot] = [:]
        for required in mod.manifest.requires.keys.sorted() {
            guard let exports = answering(required) else { throw .notRunning(required) }
            requires[required] = exports
        }

        return requires
    }

    // Whether a call from the `number`th run of `caller` into the function at `path` of what `id` exports goes to that
    // mod's page.
    public func call(from caller: String, run number: Int, mod id: String, path: [String]) throws(ExportError) {
        let callerMod = try running(caller, run: number)
        guard callerMod.manifest.requires[id] != nil else { throw .notRequired(mod: id, of: caller) }
        guard let exports = answering(id) else { throw .notRunning(id) }
        guard exports.functions.contains(path) else { throw .noSuchFunction(mod: id, path: path) }
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
}
