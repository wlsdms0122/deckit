//
//  Ownership.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// Who owns each interface: the mods that provide it queued in the order they began to, and the one the person pinned.
// The pinned provider owns it, or else the first in its queue; whether it loads or runs is not looked at.
struct Ownership: Equatable, Sendable {
    // MARK: - Property
    static let none = Ownership(queues: [:], pins: [:])

    // Interface -> the ids of the mods that provide it, the earliest first.
    let queues: [String: [String]]
    // Interface -> the id of the provider the person pinned.
    let pins: [String: String]

    // MARK: - Initializer
    // MARK: - Public
    func owner(of interface: String) -> String? {
        pins[interface] ?? queues[interface]?.first
    }

    // Interface -> its owner, for each interface that has one.
    func owners() -> [String: String] {
        queues.compactMapValues { ids in ids.first }.merging(pins) { _, pinned in pinned }
    }

    // As `providers` provide now, the mods in `kept` keeping the places they hold: a mod leaves the queue of an
    // interface it no longer provides, or when it is in neither, and joins the end of the queue of one it begins to
    // provide, those that join at once in the order given. One that keeps providing keeps its place. A pin goes as its
    // mod leaves the queue.
    func joined(by providers: [Manifest], keeping kept: Set<String>) -> Ownership {
        let provided = Dictionary(providers.map { manifest in (manifest.id, manifest) }) { first, _ in first }
        var queues = Dictionary(uniqueKeysWithValues: queues.map { interface, ids in
            (interface, ids.filter { id in kept.contains(id) || provided[id]?.provides[interface] != nil })
        })
        for manifest in providers {
            for interface in manifest.provides.keys.sorted() where !(queues[interface] ?? []).contains(manifest.id) {
                queues[interface, default: []].append(manifest.id)
            }
        }
        queues = queues.filter { _, ids in !ids.isEmpty }

        return Ownership(
            queues: queues,
            pins: pins.filter { interface, id in queues[interface]?.contains(id) ?? false }
        )
    }

    // With `id` pinned for `interface`, or its pin cleared for nil. Only a provider that provides it now among
    // `providers`, the manifests of the mods that load, is pinned: one kept with a problem keeps a pin it holds.
    func pinned(_ interface: String, to id: String?, providers: [Manifest]) throws -> Ownership {
        if let id {
            guard isPinnable(id, for: interface, providers: providers) else {
                throw PinError.notProvider(interface: interface, mod: id)
            }
        }

        var pins = pins
        pins[interface] = id

        return Ownership(queues: queues, pins: pins)
    }

    // The queue of `interface`, each provider read among `found`, the manifests of every mod found, pinnable as it is
    // among `providers`, those of the mods that load, and `definer` the name of the mod that defines it. One kept and
    // not found has no name and no majors.
    func queue(
        of interface: String,
        found: [Manifest],
        providers: [Manifest],
        definer: String?
    ) -> InterfaceQueue {
        InterfaceQueue(
            interface: interface,
            name: definer,
            owner: owner(of: interface),
            pinned: pins[interface] != nil,
            providers: (queues[interface] ?? []).map { id in
                let manifest = found.first { manifest in manifest.id == id }
                return InterfaceProvider(
                    id: id,
                    name: manifest?.name,
                    majors: manifest?.provides[interface] ?? [],
                    pinnable: isPinnable(id, for: interface, providers: providers)
                )
            }
        )
    }

    // What `interface` comes to for `manifest`, which uses it, its owner read among `found`, the manifests of every
    // mod found. An owner whose manifest is not read as providing it, one kept with a problem, is told by its own
    // problem.
    func use(of interface: String, by manifest: Manifest, found: [Manifest]) -> InterfaceUse {
        let major = manifest.uses[interface]!
        guard let id = owner(of: interface), id != manifest.id else {
            return InterfaceUse(interface: interface, major: major, owner: nil, name: nil, problem: nil)
        }
        guard let owner = found.first(where: { provider in provider.id == id }) else {
            return InterfaceUse(
                interface: interface,
                major: major,
                owner: id,
                name: nil,
                problem: "uses \(interface) \(major), and its owner \(id) is not found, so it reaches no one by it"
            )
        }

        return InterfaceUse(
            interface: interface,
            major: major,
            owner: id,
            name: owner.name,
            problem: owner.provides[interface].flatMap { majors in
                majors.contains(major)
                    ? nil
                    : "uses \(interface) \(major), and its owner \(id) provides it at "
                        + majors.map(String.init).joined(separator: ", ") + ", so it reaches no one by it"
            }
        )
    }

    // MARK: - Private
    private func isPinnable(_ id: String, for interface: String, providers: [Manifest]) -> Bool {
        providers.contains { manifest in manifest.id == id && manifest.provides[interface] != nil }
    }
}
