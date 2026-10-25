//
//  Command.swift
//  Deckit
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deck

// A command as its owner declares it: its name among the owner's, what a person and any caller read it as, and the
// arguments it takes, none without `params`.
public struct Command: Equatable, Sendable {
    // MARK: - Property
    public let name: String
    public let label: String
    public let description: String
    public let keywords: [String]
    public let params: ParameterSchema?

    // MARK: - Initializer
    // A declaration as written, `{ name, label, description, keywords, params }`, refused with why it cannot be used.
    public init(declared value: JSONValue) throws {
        guard case let .object(fields) = value, case let .string(name) = fields["name"] else {
            throw CommandError.declaration(name: "", why: "it needs a name")
        }
        guard Self.isName(name) else { throw CommandError.notAName(name) }
        guard case let .string(label) = fields["label"], !label.isEmpty else {
            throw CommandError.declaration(name: name, why: "it needs a \"label\"")
        }
        let description = if case let .string(description) = fields["description"] { description } else { "" }
        let keywords = if case let .array(words) = fields["keywords"] {
            words.compactMap { word in if case let .string(word) = word, !word.isEmpty { word } else { nil } }
        } else {
            [String]()
        }

        self.name = name
        self.label = label
        self.description = description
        self.keywords = keywords
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

    // A command's, a key's and a host's name: letters, digits, "_" and "-", so an id splits at its last ".".
    static func isName(_ name: String) -> Bool {
        !name.isEmpty && name.unicodeScalars.allSatisfy { scalar in
            (scalar.isASCII && CharacterSet.alphanumerics.contains(scalar)) || scalar == "_" || scalar == "-"
        }
    }

    // MARK: - Private
}
