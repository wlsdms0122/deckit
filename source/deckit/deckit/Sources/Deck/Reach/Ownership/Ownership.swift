//
//  Ownership.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// Who owns each interface: the mods that provide it queued in the order they began to, and the one the person pinned.
// The pinned provider owns it, or else the first in its queue; whether it runs is not looked at.
public struct Ownership: Equatable, Sendable {
    // MARK: - Property
    static let none = Ownership(queues: [:], pins: [:])

    // Interface -> the ids of the mods that provide it, the earliest first.
    public let queues: [String: [String]]
    // Interface -> the id of the provider the person pinned.
    public let pins: [String: String]

    // MARK: - Initializer
    init(queues: [String: [String]], pins: [String: String]) {
        self.queues = queues
        self.pins = pins
    }

    // MARK: - Public
    public func owner(of interface: String) -> String? {
        pins[interface] ?? queues[interface]?.first
    }

    // Interface -> its owner, for each interface that has one.
    public func owners() -> [String: String] {
        queues.compactMapValues { ids in ids.first }.merging(pins) { _, pinned in pinned }
    }

    // As the `jobs` provide now, the mods in `kept` keeping the places they hold: a mod leaves the queue of an interface
    // it no longer provides, or when it is in neither, and joins the end of the queue of one it begins to provide,
    // those that join at once in the order given. One that keeps providing keeps its place. A pin goes as its mod
    // leaves the queue.
    public func joined(by jobs: [Job], keeping kept: Set<String>) -> Ownership {
        let provided = Dictionary(jobs.map { job in (job.modId, job) }) { first, _ in first }
        var queues = Dictionary(uniqueKeysWithValues: queues.map { interface, ids in
            (interface, ids.filter { id in kept.contains(id) || provided[id]?.provides[interface] != nil })
        })
        for job in jobs {
            for interface in job.provides.keys.sorted() where !(queues[interface] ?? []).contains(job.modId) {
                queues[interface, default: []].append(job.modId)
            }
        }
        queues = queues.filter { _, ids in !ids.isEmpty }

        return Ownership(
            queues: queues,
            pins: pins.filter { interface, id in queues[interface]?.contains(id) ?? false }
        )
    }

    // Whether the person can pin `id` for `interface`: one of the `jobs` that provide now provides it.
    public func isPinnable(_ id: String, for interface: String, among jobs: [Job]) -> Bool {
        jobs.contains { job in job.modId == id && job.provides[interface] != nil }
    }

    // With `id` pinned for `interface`, or its pin cleared for nil. Only one of the `jobs` that provide now that
    // provides it is pinned.
    func pinned(_ interface: String, to id: String?, among jobs: [Job]) throws -> Ownership {
        if let id {
            guard isPinnable(id, for: interface, among: jobs) else {
                throw PinError.notProvider(interface: interface, mod: id)
            }
        }

        var pins = pins
        pins[interface] = id

        return Ownership(queues: queues, pins: pins)
    }

    // MARK: - Private
}
