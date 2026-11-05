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

    // As `providers` provide now: a mod leaves the queue of an interface it no longer provides, or when it is not among
    // them, and joins the end of the queue of one it begins to provide, those that join at once in the order given.
    // One that keeps providing keeps its place. A pin goes as its mod leaves the queue.
    func joined(by providers: [Manifest]) -> Ownership {
        let provided = Dictionary(providers.map { manifest in (manifest.id, manifest) }) { first, _ in first }
        var queues = Dictionary(uniqueKeysWithValues: queues.map { interface, ids in
            (interface, ids.filter { id in provided[id]?.provides[interface] != nil })
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

    // With `id` pinned for `interface`, or its pin cleared for nil.
    func pinned(_ interface: String, to id: String?) -> Ownership {
        var pins = pins
        pins[interface] = id

        return Ownership(queues: queues, pins: pins)
    }

    // The queue of `interface`, each provider read among `providers`, and `definer` the name of the mod that defines
    // it.
    func queue(of interface: String, providers: [Manifest], definer: String?) -> InterfaceQueue {
        InterfaceQueue(
            interface: interface,
            name: definer,
            owner: owner(of: interface),
            pinned: pins[interface] != nil,
            providers: (queues[interface] ?? []).compactMap { id in
                providers.first { manifest in manifest.id == id }.map { manifest in
                    InterfaceProvider(id: id, name: manifest.name, majors: manifest.provides[interface] ?? [])
                }
            }
        )
    }

    // What `interface` comes to for `manifest`, which uses it, its owner read among `providers`.
    func use(of interface: String, by manifest: Manifest, providers: [Manifest]) -> InterfaceUse {
        let major = manifest.uses[interface]!
        let owner = owner(of: interface).flatMap { id in
            id == manifest.id ? nil : providers.first { provider in provider.id == id }
        }
        let majors = owner?.provides[interface] ?? []

        return InterfaceUse(
            interface: interface,
            major: major,
            owner: owner?.id,
            name: owner?.name,
            problem: owner.flatMap { owner in
                majors.contains(major)
                    ? nil
                    : "uses \(interface) \(major), and its owner \(owner.id) provides it at "
                        + majors.map(String.init).joined(separator: ", ") + ", so it reaches no one by it"
            }
        )
    }

    // MARK: - Private
}
