//
//  CommandProvider.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What declares commands and the keys that run them, and runs them: a host, under a name it gives that starts with
// "@" (the host app, the shell it puts on deckit), or a mod, whose run contributed them. Each with its name as a
// person reads it.
public enum CommandProvider: Equatable, Sendable {
    case host(id: String, name: String)
    case mod(id: String, name: String)

    // MARK: - Property
    // What a command's and a binding's id starts with: a mod's id, or the host's name, which no mod id starts with.
    public var id: String {
        switch self {
        case let .host(id, _), let .mod(id, _):
            id
        }
    }

    public var name: String {
        switch self {
        case let .host(_, name), let .mod(_, name):
            name
        }
    }

    public var isHost: Bool {
        if case .host = self { return true }
        return false
    }

    // MARK: - Initializer
    // MARK: - Public
    // The id of the provider's command or binding of `name`, as a person reads it.
    func id(of name: String) -> String {
        "\(id).\(name)"
    }

    // MARK: - Private
}
