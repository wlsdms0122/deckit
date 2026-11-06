//
//  ListPreference.swift
//  Deckit
//
//  Created by JSilver on 11/4/26.
//

import Foundation
import Deck

// How the person arranged a list of mods, such as a scheme's handlers: the mods placed, in order, and those switched
// off, by id.
public struct ListPreference: Codable, Equatable, Sendable {
    // MARK: - Property
    public static let none = ListPreference(order: [], off: [])

    public let order: [String]
    public let off: [String]

    // MARK: - Initializer
    public init(order: [String], off: [String]) {
        self.order = order
        self.off = off
    }

    // MARK: - Public
    // The ids placed in the list, in order: the person's, then those of `host`, the host app's, they did not place.
    public func placed(host: [String]) -> [String] {
        order + host.filter { id in !self.order.contains(id) }
    }

    // As the person sets it, over the ids placed with `host`: the ids in `order` take the places they held among
    // themselves, in the order given, and those placed that stand in the list, `listed`, and `order` does not name come
    // after them. One placed that is not in the list now keeps its place and switch. Those in `off` are switched off.
    public func arranged(order: [String], off: [String], host: [String], listed: [String]) -> ListPreference {
        let placed = placed(host: host)
        let given = Set(order)
        let standing = Set(listed)
        var next = (order + placed.filter { id in standing.contains(id) && !given.contains(id) })[...]
        let kept = placed.compactMap { id in standing.contains(id) || given.contains(id) ? next.popFirst() : id }

        return ListPreference(
            order: kept + next,
            off: self.off.filter { id in !given.contains(id) } + off
        )
    }

    // MARK: - Private
}
