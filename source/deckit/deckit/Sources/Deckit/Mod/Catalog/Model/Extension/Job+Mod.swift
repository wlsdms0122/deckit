//
//  Job+Mod.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

extension Job {
    // MARK: - Property
    // MARK: - Initializer
    // What deck runs of `mod`, which loads: the permissions its manifest asks for that this host defines granted, as
    // installing it consented to them, and every mod reached by id for one granted deckit.reach-mods, none otherwise.
    // Nil for a mod with no entry.
    init?(_ mod: Mod) {
        guard let entry = mod.entry else { return nil }

        let permissions = mod.manifest.permissions.filter(\.usable).map(\.id)
        self.init(
            modId: mod.manifest.id,
            revision: mod.revision,
            entry: entry,
            permissions: permissions,
            reaches: permissions.contains(Deckit.reachMods.id) ? .every : .only([]),
            uses: mod.manifest.uses,
            provides: mod.manifest.provides
        )
    }

    // MARK: - Public
    // MARK: - Private
}
