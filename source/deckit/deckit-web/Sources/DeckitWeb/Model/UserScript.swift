//
//  UserScript.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation
import CNodeAPI

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
    // `[{ source, world, mainFrameOnly }]`, `world` the page's where it is not deckit's, `mainFrameOnly` true unless
    // false.
    @MainActor
    static func read(_ node: Node, _ value: napi_value) throws -> [UserScript] {
        try node.array(value).map { script in
            guard let source = try node.member(script, "source") else {
                throw NodeError(message: "a script needs its source")
            }
            let world = try node.member(script, "world").map { try node.string($0) }

            return UserScript(
                source: try node.string(source),
                world: world.flatMap(World.init) ?? .page,
                mainFrameOnly: try node.member(script, "mainFrameOnly").map { try node.bool($0) } ?? true
            )
        }
    }

    // MARK: - Private
}
