//
//  ExtensionRegistry.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod opens extension points and another extends them. The one that extends requires the point's mod, so it starts
// after that one has and ends before it does, or has it as an optional dependency at a version it names: then it
// extends the point while both run, and runs on either way. A point is open from when its mod's run starts until it has
// ended. A running mod extends it once it is open, until its own run has ended: one that is ending takes no point
// opened since. What extends a point stays in its own page, which answers the calls the point's mod makes into it.
public final class ExtensionRegistry {
    // MARK: - Property
    private let runner: Runner
    // Point mod id -> its run last told what extends its points, and as told, by point name: mod id -> the run of it
    // that extends the point.
    private var told: [String: (run: Int, points: [String: [String: Int]])] = [:]
    // Mod id -> the scoped names of the points it extends, as told.
    private var toldExtends: [String: [String]] = [:]

    // MARK: - Initializer
    init(runner: Runner) {
        self.runner = runner
    }

    // MARK: - Public
    // What `run` of `mod` extends that it cannot: a point not named `<mod id>:<point>`, one of a mod it neither requires
    // nor has as an optional dependency, or one a mod it requires does not open. An optional dependency may not run, or
    // not open the point, and then nothing is wrong.
    func problems(of run: Run, mod: Mod) -> [String] {
        guard let contributions = run.contributions else { return [] }

        return contributions.extensions.keys.sorted().compactMap { point in
            guard let scoped = ScopedName(point) else {
                return "deck.extend() names \(point), which is not <mod id>:<point>"
            }
            if mod.manifest.requires[scoped.modId] == nil {
                guard mod.manifest.optional[scoped.modId] != nil else {
                    return "deck.extend() names \(point), but \(scoped.modId) is in neither [requires] nor [optional]"
                }
                return nil
            }
            guard opened(scoped) else { return "deck.extend() names \(point), which \(scoped.modId) does not open" }
            return nil
        }
    }

    // A call from the `number`th run of `caller` into the function at `path` of what `id` extends `point`, one of the
    // caller's, with.
    public func call(
        from caller: String,
        run number: Int,
        mod id: String,
        point: String,
        path: [String]
    ) throws(ExtensionError) {
        guard let scoped = ScopedName(point), scoped.modId == caller else { throw .notAPoint(point, of: caller) }
        guard let run = runner.run(of: caller), run.number == number, run.state != .notRunning else {
            throw .notRunning(caller)
        }
        guard let extended = extensions(of: caller)[scoped.name]?[id] else {
            throw .notExtending(mod: id, point: point)
        }
        guard extended.extension.functions.contains(path) else {
            throw .noSuchFunction(mod: id, point: point, path: path)
        }
    }

    // What each point's mod has not been told yet, what extends one of its points now, and the points each mod
    // extends now where they changed. A run new since is told what extends each point once something does.
    func changes() -> [Effect] {
        var effects: [Effect] = []
        var now: [String: (run: Int, points: [String: [String: Int]])] = [:]
        var extends: [String: [String]] = [:]
        for mod in runner.mods() {
            let id = mod.manifest.id
            guard let run = runner.run(of: id), isOpen(run) else { continue }

            let before = told[id].flatMap { told in told.run == run.number ? told.points : nil } ?? [:]
            let points = extensions(of: id)
            for (name, extending) in points.sorted(by: { one, other in one.key < other.key }) {
                for extender in extending.keys {
                    extends[extender, default: []].append(ScopedName(modId: id, name: name).description)
                }
                guard extending.mapValues(\.run) != before[name, default: [:]] else { continue }
                let extensions = extending.mapValues(\.extension)
                effects.append(.extensionsChanged(modId: id, run: run.number, name: name, extensions: extensions))
            }
            now[id] = (run.number, points.mapValues { extending in extending.mapValues(\.run) })
        }
        told = now
        for id in Set(toldExtends.keys).union(extends.keys).sorted() {
            let points = extends[id, default: []].sorted()
            if points != toldExtends[id, default: []] {
                effects.append(.extendsChanged(modId: id, points: points))
            }
        }
        toldExtends = extends

        return effects
    }

    // MARK: - Private
    // What extends each point the mod opens now, by point name: mod id -> the run that extends it, and with what.
    private func extensions(of opener: String) -> [String: [String: (run: Int, extension: Snapshot)]] {
        guard let openerMod = runner.mod(of: opener),
            let openerRun = runner.run(of: opener),
            isOpen(openerRun),
            let contributions = openerRun.contributions
        else { return [:] }

        let told = told[opener].flatMap { told in told.run == openerRun.number ? told.points : nil } ?? [:]
        var points = Dictionary(
            contributions.extensionPoints.map { name in (name, [String: (run: Int, extension: Snapshot)]()) },
            uniquingKeysWith: { first, _ in first }
        )
        for mod in runner.mods()
        where mod.manifest.requires[opener] != nil || mod.manifest.takesOptional(openerMod.manifest) {
            let id = mod.manifest.id
            guard let run = runner.run(of: id), isOpen(run), let extensions = run.contributions?.extensions else {
                continue
            }

            for (point, extended) in extensions {
                guard let scoped = ScopedName(point), scoped.modId == opener, points[scoped.name] != nil else {
                    continue
                }
                guard run.state == .running || told[scoped.name]?[id] == run.number else { continue }
                points[scoped.name]?[id] = (run.number, extended)
            }
        }

        return points
    }

    private func opened(_ point: ScopedName) -> Bool {
        guard let run = runner.run(of: point.modId), isOpen(run) else { return false }
        return run.contributions?.extensionPoints.contains(point.name) ?? false
    }

    // A run that launched holds what it contributed until it has ended.
    private func isOpen(_ run: Run) -> Bool {
        run.contributions != nil && (run.state == .running || run.state == .terminating)
    }
}
