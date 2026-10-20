//
//  ResolvedKeymap.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The keymap as a keystroke is resolved, as the driver was told it: `revision` counts each telling, so of two the
// driver keeps the later, whichever way each came.
struct ResolvedKeymap: Encodable, Equatable, Sendable {
    // MARK: - Property
    let revision: Int
    let bindings: [ResolvedBinding]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
