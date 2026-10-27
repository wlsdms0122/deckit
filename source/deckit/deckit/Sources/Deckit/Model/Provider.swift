//
//  Provider.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What declares commands and keys, and runs them: a host, under a name it gives that starts with "@" (the host app, or
// what it puts on deckit), or a mod, whose run contributed them. Each with its name as a person reads it.
public enum Provider: Equatable, Sendable {
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
    // A host of `id`, a name that starts with "@", or nil.
    init?(host id: String, name: String) {
        guard id.hasPrefix("@"), Self.isName(String(id.dropFirst())) else { return nil }
        self = .host(id: id, name: name)
    }

    // MARK: - Public
    // The id of the provider's command or binding of `name`, as a person reads it.
    func id(of name: String) -> String {
        "\(id).\(name)"
    }

    // A command's, a key's and a host's name: letters, digits, "_" and "-", so an id splits at its last ".".
    static func isName(_ name: String) -> Bool {
        !name.isEmpty && name.unicodeScalars.allSatisfy { scalar in
            (scalar.isASCII && CharacterSet.alphanumerics.contains(scalar)) || scalar == "_" || scalar == "-"
        }
    }

    // MARK: - Private
}
