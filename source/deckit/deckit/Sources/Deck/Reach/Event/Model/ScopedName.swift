//
//  ScopedName.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A name scoped by the principal that owns it, as another principal names it: `<principal>:<name>`. An event and an
// extension point are named so. A principal holds no colon, so the first one ends it.
package struct ScopedName: Hashable, Sendable {
    // MARK: - Property
    package let principal: String
    package let name: String

    // MARK: - Initializer
    package init(principal: String, name: String) {
        self.principal = principal
        self.name = name
    }

    // Nil for what names no principal, or no name of one.
    package init?(_ written: String) {
        guard let colon = written.firstIndex(of: ":"),
            colon != written.startIndex,
            written.index(after: colon) != written.endIndex
        else { return nil }

        self.principal = String(written[..<colon])
        self.name = String(written[written.index(after: colon)...])
    }

    // MARK: - Public
    // MARK: - Private
}
