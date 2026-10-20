//
//  Deckit.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The platform on deck: what it adds, and what deck answers under it.
public final class Deckit {
    // MARK: - Property
    private let deck: Deck
    private let keymap: Keymap

    // MARK: - Initializer
    // `name` is the app's, as a person reads it, and `permissions` are those main defines, for what deck, deckit and the
    // shell add; the core adds those it checks itself.
    public init(home: URL, ship: [URL], sources: [URL], api: Version, name: String, permissions: [Permission]) throws {
        let deck = try Deck(
            home: home,
            ship: ship,
            sources: sources,
            api: api,
            permissions: permissions + [Keymap.globalKeys],
            fields: [URLSchemesField()]
        )
        let keymap = Keymap(deck: deck, appName: name)
        deck.add(keymap)
        self.deck = deck
        self.keymap = keymap
    }

    // MARK: - Public
    public func answer(_ call: Call) throws -> (any Encodable & Sendable)? {
        switch call.method {
        case "keymap/register":
            return keymap.register(try call.params.decode(as: Key.self))

        case "keymap/bind":
            let params = try call.params.decode(as: BindKeyParams.self)
            return try keymap.bind(params.id, spec: params.spec)

        case "keymap/reset":
            let params = try call.params.decode(as: ResetKeyParams.self)
            return try keymap.reset(params.id)

        case "keymap/record":
            let params = try call.params.decode(as: RecordKeyParams.self)
            return keymap.record(params.keystroke)

        case "keymap/keystrokes":
            let params = try call.params.decode(as: KeystrokesParams.self)
            return keymap.keystrokes(of: params.specs)

        default:
            return try deck.answer(call)
        }
    }

    // MARK: - Private
}
