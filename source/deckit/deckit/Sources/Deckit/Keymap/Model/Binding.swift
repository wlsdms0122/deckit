//
//  Binding.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A key in the keymap, by its id: its owner's and its action's. `defaultKeystroke` is the chord it is declared with,
// `keystroke` the one it is bound to now, none when it is unbound, and `changed` whether a person changed it from
// today's default.
struct Binding: Equatable, Sendable {
    // MARK: - Property
    let owner: BindingOwner
    let scope: BindingScope
    let action: String
    let label: String
    let defaultKeystroke: Keystroke?
    let keystroke: Keystroke?
    let changed: Bool

    var id: String {
        owner.bindingId(of: action)
    }

    // MARK: - Initializer
    // MARK: - Public
    // Whether a keystroke may be resolved to either: two mods' own keys never meet, each running only in its mod's
    // page.
    func meets(_ other: Binding) -> Bool {
        !(scope == .mod && other.scope == .mod && owner != other.owner)
    }

    // MARK: - Private
}
