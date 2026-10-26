//
//  Command.swift
//  Deckit
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deck

// A command as its provider declares it: its name among the provider's, what any caller reads it as, and the arguments
// it takes, none without `params`.
public struct Command: Equatable, Sendable {
    // MARK: - Property
    public let name: String
    public let description: String
    public let params: ParameterSchema?

    // MARK: - Initializer
    // A declaration as written, `{ name, description, params }`, refused with why it cannot be used.
    public init(declared value: JSONValue) throws {
        guard case let .object(fields) = value, case let .string(name) = fields["name"] else {
            throw CommandError.declaration(name: "", why: "it needs a name")
        }
        guard Provider.isName(name) else { throw CommandError.notAName(name) }

        self.name = name
        self.description = if case let .string(description) = fields["description"] { description } else { "" }
        do {
            self.params = try fields["params"].map(ParameterSchema.init)
        } catch let CommandError.schema(why) {
            throw CommandError.declaration(name: name, why: "its \"params\" \(why)")
        }
    }

    // MARK: - Public
    // Why `args` do not fit what it takes, or nil. One without `params` takes none.
    public func problem(ofArguments args: JSONValue?) -> String? {
        guard let params else {
            guard let args, args != .object([:]) else { return nil }
            return "it takes no args"
        }

        return params.problem(of: args ?? .object([:]))
    }

    // MARK: - Private
}
