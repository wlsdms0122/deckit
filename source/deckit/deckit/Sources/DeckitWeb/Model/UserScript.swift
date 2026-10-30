//
//  UserScript.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation

// A script every document of a page runs as it starts: in the page's own world, which the page's scripts share, or
// in deckit's, which they do not see.
struct UserScript {
    // MARK: - Property
    enum World: String {
        case page
        case deckit
    }

    let source: String
    let world: World
    let mainFrameOnly: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
