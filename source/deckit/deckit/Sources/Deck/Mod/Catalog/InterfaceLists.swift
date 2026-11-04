//
//  InterfaceLists.swift
//  Deck
//
//  Created by JSilver on 11/4/26.
//

import Foundation

// A list for each interface a mod names in its `implements` or its [dependencies]: the mods that implement it, but for
// those that do not load by their own manifest. Whether what a mod requires is there, and whether it runs, keep no mod
// off a list. The person's order comes first, then the host app's, then the mods no one placed, by id.
struct InterfaceLists {
    // MARK: - Property
    // By interface.
    let lists: [InterfaceList]
    // Interface -> the id of the mod picked for it.
    var picks: [String: String] {
        Dictionary(
            uniqueKeysWithValues: lists.compactMap { list in list.pick.map { pick in (list.interface, pick.id) } }
        )
    }

    // MARK: - Initializer
    // `found` is every mod found, each with a problem only of its own: its manifest's or its folder's. `kept` is the
    // person's order of each interface, and `host` the mods the host app places in each.
    init(found: [Mod], kept: [String: ImplementationPreference], host: [String: [String]]) {
        let loadable = found.filter { mod in mod.problem == nil }
        let named = Set(loadable.flatMap { mod in
            Array(mod.manifest.implements.keys) + Array(mod.manifest.dependencies.keys)
        })

        self.lists = named.sorted().map { interface in
            let members = loadable.filter { mod in mod.manifest.implements[interface] != nil }
            let preference = kept[interface] ?? .none
            let order = preference.order + (host[interface] ?? []).filter { id in !preference.order.contains(id) }
            let placed = order.compactMap { id in members.first { mod in mod.manifest.id == id } }
            let unplaced = members
                .filter { mod in !order.contains(mod.manifest.id) }
                .sorted { mod, other in mod.manifest.id < other.manifest.id }
            let isOn = { (mod: Mod) in !preference.off.contains(mod.manifest.id) }
            let definer = interface.split(separator: "/").first.map(String.init)

            return InterfaceList(
                interface: interface,
                name: found.first { mod in mod.manifest.id == definer }?.manifest.name,
                undecided: unplaced.filter(isOn).count >= 2 && !placed.contains(where: isOn),
                implementations: (placed + unplaced).map { mod in
                    Implementation(
                        id: mod.manifest.id,
                        name: mod.manifest.name,
                        version: mod.manifest.implements[interface]!,
                        on: isOn(mod)
                    )
                }
            )
        }
    }

    // MARK: - Public
    // MARK: - Private
}
