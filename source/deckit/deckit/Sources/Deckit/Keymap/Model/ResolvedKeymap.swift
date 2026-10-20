//
//  ResolvedKeymap.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The keymap as a keystroke is resolved, as the driver was told it: `revision` counts each telling, so of two the
// driver keeps the later, whichever way each came.
public struct ResolvedKeymap: LayerChange, Equatable {
    // MARK: - Property
    public let revision: Int
    public let bindings: [ResolvedBinding]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
