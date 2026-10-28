//
//  DependencyGraph.swift
//  Deck
//
//  Created by JSilver on 10/22/26.
//

import Foundation

// The mods found, joined by their dependencies: whether each loads by what it requires, and who requires whom. A mod
// requires its dependencies that are not optional.
struct DependencyGraph {
    // MARK: - Property
    private let found: [Mod]
    // Mod id -> its place in `found`, the first of an id.
    private let places: [String: Int]

    // MARK: - Initializer
    init(_ found: [Mod]) {
        self.found = found
        self.places = Dictionary(found.enumerated().map { place, mod in (mod.manifest.id, place) }) { first, _ in first }
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
                for id in manifest.required {
                    let want = manifest.dependencies[id]!.version
                    guard let problem = problem(id, want: want, provider: places[id].map { mods[$0] }) else {
                        continue
                    }

                    mods[place].problem = problem
                    changed = true
                    break
                }
            }
        }

        let provided = mods
        for place in mods.indices {
            let manifest = mods[place].manifest
            mods[place].relations = relations(manifest.dependencies, in: provided)
            mods[place].dependents = dependents(of: manifest.id, in: provided)
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
                for other in mod.manifest.required.compactMap({ id in places[id] }).sorted() {
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
            let later = mod.manifest.required.first { id in loading.contains(id) && !placed.contains(id) }
            if let later {
                return (mod.manifest.id, later)
            }
            placed.insert(mod.manifest.id)
        }

        return nil
    }

    // MARK: - Private
    // The mods that load and require `id`, directly or through another, by id: none of them loads without it. One that
    // does not load, for this or another reason, is not among them.
    private func dependents(of id: String, in mods: [Mod]) -> [String] {
        var reached: Set<String> = []
        var next = [id]
        while let current = next.popLast() {
            for mod in mods where mod.problem == nil && mod.manifest.required.contains(current) {
                guard reached.insert(mod.manifest.id).inserted else { continue }
                next.append(mod.manifest.id)
            }
        }
        reached.remove(id)

        return reached.sorted()
    }

    private func relations(_ dependencies: [String: Dependency], in mods: [Mod]) -> [Relation] {
        dependencies.sorted { one, other in one.key < other.key }.map { id, dependency in
            let provider = places[id].map { place in mods[place] }
            return Relation(
                id: id,
                optional: dependency.optional,
                want: dependency.version,
                name: provider?.manifest.name ?? id,
                ok: problem(id, want: dependency.version, provider: provider) == nil
            )
        }
    }

    private func problem(_ id: String, want: String, provider: Mod?) -> String? {
        guard let provider else { return "needs \(id), which is not installed" }
        guard provider.problem == nil else { return "needs \(id), which did not load" }
        guard let version = provider.manifest.version.flatMap(Version.init),
            let wanted = Version(want),
            version.satisfies(wanted)
        else {
            return "needs \(id) \(want), and \(id) is \(provider.manifest.version ?? "of no version")"
        }

        return nil
    }

    private func cycles() -> [[String]] {
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
            for other in found[places[id]!].manifest.required where places[other] != nil {
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
}
