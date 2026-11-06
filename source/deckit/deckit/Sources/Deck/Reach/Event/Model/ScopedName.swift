//
//  ScopedName.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A name scoped by the mod that owns it, as another mod names it: `<mod id>:<name>`. An event and an extension point
// are named so. A mod id holds no colon, so the first one ends it.
package struct ScopedName: Hashable, Sendable {
    // MARK: - Property
    package let modId: String
    package let name: String

    // MARK: - Initializer
    package init(modId: String, name: String) {
        self.modId = modId
        self.name = name
    }

    // Nil for what names no mod, or no name of one.
    package init?(_ written: String) {
        guard let colon = written.firstIndex(of: ":"),
            colon != written.startIndex,
            written.index(after: colon) != written.endIndex
        else { return nil }

        self.modId = String(written[..<colon])
        self.name = String(written[written.index(after: colon)...])
    }

    // MARK: - Public
    // MARK: - Private
}
