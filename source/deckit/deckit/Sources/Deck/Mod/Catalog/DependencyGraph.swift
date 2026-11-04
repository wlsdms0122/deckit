//
//  DependencyGraph.swift
//  Deck
//
//  Created by JSilver on 10/22/26.
//

import Foundation

// The mods found, joined by their dependencies through the implementation picked for each interface: whether each
// loads by what it requires, and who requires whom. A mod requires the mods picked for the interfaces it names without
// `optional`.
struct DependencyGraph {
    // MARK: - Property
    private let found: [Mod]
    // Mod id -> its place in `found`, the first of an id.
    private let places: [String: Int]
    // Interface -> the id of the mod picked for it.
    private let picks: [String: String]

    // MARK: - Initializer
    init(_ found: [Mod], picks: [String: String]) {
        self.found = found
        self.places = Dictionary(found.enumerated().map { place, mod in (mod.manifest.id, place) }) { first, _ in first }
        self.picks = picks
    }

    // MARK: - Public
    // A cycle fails every mod in it; then a failure spreads to whoever requires it, until nothing changes. Each lists
    // its dependencies, of which an optional one stops nothing, and the mods that require it.
    func resolved() -> [Mod] {
        var mods = found
        for loop in cycles() {
            for id in loop {
                guard let place = places[id], mods[place].problem == nil else { continue }
                mods[place].problem = "requires itself: " + loop.joined(separator: " → ")
            }
        }

        var changed = true
        while changed {
            changed = false
            for place in mods.indices where mods[place].problem == nil {
                let manifest = mods[place].manifest
                for interface in manifest.required {
                    let dependency = manifest.dependencies[interface]!
                    guard let problem = problem(interface, dependency, in: mods) else { continue }

                    mods[place].problem = problem
                    changed = true
                    break
                }
            }
        }

        let resolved = mods
        for place in mods.indices {
            let manifest = mods[place].manifest
            mods[place].relations = relations(of: manifest, in: resolved)
            mods[place].dependents = dependents(of: manifest.id, in: resolved)
        }

        return mods
    }

    // Every mod in one order, as found, but for a mod that loads coming after the mods it requires: one found later is
    // put just before the first that requires it. One that does not load keeps its place.
    func ordered() -> [Mod] {
        let mods = resolved()
        var placed: [Mod] = []
        var ids: Set<String> = []
        func place(_ mod: Mod) {
            guard ids.insert(mod.manifest.id).inserted else { return }
            if mod.problem == nil {
                for other in requirements(of: mod.manifest).compactMap({ id in places[id] }).sorted() {
                    place(mods[other])
                }
            }
            placed.append(mod)
        }

        for mod in mods {
            place(mod)
        }

        return placed
    }

    // The first mod that loads placed, as found, before a mod it requires, with that one, or nil when each comes after
    // what it requires, as `ordered()` puts them.
    func requiredLater() -> (mod: String, requirement: String)? {
        let mods = resolved().filter { mod in mod.problem == nil }
        let loading = Set(mods.map(\.manifest.id))
        var placed: Set<String> = []
        for mod in mods {
            let later = requirements(of: mod.manifest).first { id in loading.contains(id) && !placed.contains(id) }
            if let later {
                return (mod.manifest.id, later)
            }
            placed.insert(mod.manifest.id)
        }

        return nil
    }

    // Each cycle of mods that require one another, as `<id> → … → <id>`, the first id again at its end.
    func cycles() -> [[String]] {
        var visiting: Set<String> = []
        var visited: Set<String> = []
        var loops: [[String]] = []
        func visit(_ id: String, trail: [String]) {
            guard !visited.contains(id) else { return }
            if visiting.contains(id), let start = trail.firstIndex(of: id) {
                loops.append(Array(trail[start...]) + [id])
                return
            }

            visiting.insert(id)
            for other in requirements(of: found[places[id]!].manifest) where places[other] != nil {
                visit(other, trail: trail + [id])
            }
            visiting.remove(id)
            visited.insert(id)
        }

        for mod in found {
            visit(mod.manifest.id, trail: [])
        }

        return loops
    }

    // MARK: - Private
    // The ids of the mods picked for the interfaces it requires, in the order of those interfaces, each once.
    private func requirements(of manifest: Manifest) -> [String] {
        var seen: Set<String> = [manifest.id]
        return manifest.required.compactMap { interface in picks[interface] }.filter { id in seen.insert(id).inserted }
    }

    // The mods that load and require `id`, directly or through another, by id: none of them loads without it. One that
    // does not load, for this or another reason, is not among them.
    private func dependents(of id: String, in mods: [Mod]) -> [String] {
        var reached: Set<String> = []
        var next = [id]
        while let current = next.popLast() {
            for mod in mods where mod.problem == nil && requirements(of: mod.manifest).contains(current) {
                guard reached.insert(mod.manifest.id).inserted else { continue }
                next.append(mod.manifest.id)
            }
        }
        reached.remove(id)

        return reached.sorted()
    }

    private func relations(of manifest: Manifest, in mods: [Mod]) -> [Relation] {
        manifest.dependencies.sorted { one, other in one.key < other.key }.map { interface, dependency in
            let pick = picks[interface].flatMap { id in places[id] }.map { place in mods[place] }
            return Relation(
                interface: interface,
                optional: dependency.optional,
                version: dependency.version,
                id: pick?.manifest.id,
                name: pick?.manifest.name,
                problem: dependency.optional
                    ? mismatch(interface, dependency, of: manifest, pick: pick)
                    : problem(interface, dependency, in: mods)
            )
        }
    }

    // What is wrong with an optional dependency: only a version that does not satisfy, of a mod that loads and is not
    // the dependent itself, which is as if none were picked.
    private func mismatch(_ interface: String, _ dependency: Dependency, of manifest: Manifest, pick: Mod?) -> String? {
        guard let pick,
            pick.manifest.id != manifest.id,
            pick.problem == nil,
            !dependency.isSatisfied(by: pick.manifest.implements[interface])
        else { return nil }

        return "uses \(interface) \(dependency.version), and \(pick.manifest.id) implements it at "
            + "\(pick.manifest.implements[interface] ?? "no version"), so it runs without it"
    }

    private func problem(_ interface: String, _ dependency: Dependency, in mods: [Mod]) -> String? {
        guard let id = picks[interface] else { return "needs \(interface), which no mod implements" }
        guard let pick = places[id].map({ place in mods[place] }), pick.problem == nil else {
            return "needs \(interface), which \(id) implements and did not load"
        }
        let implemented = pick.manifest.implements[interface]
        guard dependency.isSatisfied(by: implemented) else {
            return "needs \(interface) \(dependency.version), and \(id) implements it at \(implemented ?? "no version")"
        }

        return nil
    }
}
