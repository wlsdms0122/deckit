//
//  Binding.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A key in the keymap, by its id: its provider's, which runs it, and its name's. `defaultKeystroke` is the chord it is
// declared with, `keystroke` the one it is bound to now, none when it is unbound, and `changed` whether a person changed
// it from today's default.
public struct Binding: Equatable, Sendable {
    // MARK: - Property
    public let provider: Provider
    public let scope: KeyScope
    public let name: String
    public let label: String
    public let defaultKeystroke: Keystroke?
    public let keystroke: Keystroke?
    public let changed: Bool

    public var id: String {
        provider.id(of: name)
    }

    // MARK: - Initializer
    // MARK: - Public
    // Whether both work in the same place, so that of a chord both are bound to only the first listed runs: keys of
    // one scope, and in the page in front, of one provider.
    func contends(with other: Binding) -> Bool {
        scope == other.scope && (scope.isWide || provider == other.provider)
    }

    // MARK: - Private
}
