//
//  DependencyGraph.swift
//  Deck
//
//  Created by JSilver on 10/22/26.
//

import Foundation

// The mods found, joined by what each requires and uses optionally: whether each loads by what it requires, and who
// requires whom.
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
    // what it requires, then its optional dependencies, which stop nothing, and the mods that require it.
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
                for (id, want) in mods[place].manifest.requires.sorted(by: { one, other in one.key < other.key }) {
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
            mods[place].dependencies = dependencies(manifest.requires, optional: false, in: provided)
                + dependencies(manifest.optional, optional: true, in: provided)
            mods[place].dependents = dependents(of: manifest.id, in: provided)
        }

        return mods
    }

    // Every mod in one order, as found, but for a mod that loads coming after the mods it links, those it requires and
    // those it uses optionally that load: one found later is put just before the first that links it. One that does
    // not load keeps its place.
    func ordered() -> [Mod] {
        let mods = resolved()
        var placed: [Mod] = []
        var ids: Set<String> = []
        func place(_ mod: Mod) {
            guard ids.insert(mod.manifest.id).inserted else { return }
            if mod.problem == nil {
                let linked = (Array(mod.manifest.requires.keys) + Array(mod.manifest.optional.keys))
                    .compactMap { id in places[id] }
                    .filter { other in mods[other].problem == nil }
                for other in linked.sorted() {
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

    // MARK: - Private
    // The mods that load and require `id`, directly or through another, by id: none of them loads without it. One that
    // does not load, for this or another reason, is not among them.
    private func dependents(of id: String, in mods: [Mod]) -> [String] {
        var reached: Set<String> = []
        var next = [id]
        while let current = next.popLast() {
            for mod in mods where mod.problem == nil && mod.manifest.requires[current] != nil {
                guard reached.insert(mod.manifest.id).inserted else { continue }
                next.append(mod.manifest.id)
            }
        }
        reached.remove(id)

        return reached.sorted()
    }

    private func dependencies(_ wanted: [String: String], optional: Bool, in mods: [Mod]) -> [Dependency] {
        wanted.sorted { one, other in one.key < other.key }.map { id, want in
            let provider = places[id].map { place in mods[place] }
            return Dependency(
                id: id,
                want: want,
                name: provider?.manifest.name ?? id,
                ok: problem(id, want: want, provider: provider) == nil,
                optional: optional
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
            for other in found[places[id]!].manifest.requires.keys.sorted() where places[other] != nil {
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
