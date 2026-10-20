//
//  BindingOwner.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Whose key a binding is: the app's, registered by the host app and the shell it puts on deckit, or a mod's, which
// its run contributed. Each with its name as a person reads it.
public enum BindingOwner: Equatable, Sendable {
    case app(name: String)
    case mod(id: String, name: String)

    // MARK: - Property
    // What a binding's id starts with: a mod's id, and for the app what no mod id starts with.
    public var id: String {
        switch self {
        case .app:
            "@app"

        case let .mod(id, _):
            id
        }
    }

    public var name: String {
        switch self {
        case let .app(name), let .mod(_, name):
            name
        }
    }

    public var isApp: Bool {
        if case .app = self { return true }
        return false
    }

    // MARK: - Initializer
    // MARK: - Public
    // The id of the owner's binding of `action`.
    func bindingId(of action: String) -> String {
        "\(id).\(action)"
    }

    // MARK: - Private
}
