//
//  ParameterSchema.swift
//  Deckit
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deck

// The args a command takes, as a subset of JSON Schema, read as JSON Schema reads it: `type`, `properties`,
// `required`, `items`, `enum`, and `oneOf` of `const`s, with `title` and `description` anywhere. The args are an
// object.
public struct ParameterSchema: Equatable, Sendable {
    // MARK: - Property
    private static let keywords: Set<String> = [
        "type", "properties", "required", "items", "enum", "oneOf", "title", "description"
    ]
    private static let choiceKeywords: Set<String> = ["const", "title", "description"]
    private static let types: Set<String> = ["object", "array", "string", "number", "integer", "boolean"]

    // As written.
    public let value: JSONValue

    // MARK: - Initializer
    // Refused with why for a schema of another keyword, or args that are not an object.
    public init(_ value: JSONValue) throws {
        try Self.check(value)
        guard case let .object(fields) = value, fields["type"] == .string("object") else {
            throw CommandError.schema("takes { type: 'object' }")
        }

        self.value = value
    }

    // MARK: - Public
    // Why `args` do not fit, or nil.
    public func problem(of args: JSONValue) -> String? {
        Self.problem(of: args, against: value, at: "args")
    }

    // MARK: - Private
    private static func check(_ schema: JSONValue) throws {
        guard case let .object(fields) = schema else { throw CommandError.schema("has a schema that is no object") }
        if let unknown = fields.keys.sorted().first(where: { keyword in !keywords.contains(keyword) }) {
            throw CommandError.schema("has \"\(unknown)\", which deckit does not read")
        }
        if let type = fields["type"] {
            guard case let .string(name) = type, types.contains(name) else {
                throw CommandError.schema("has a \"type\" that is not one of \(types.sorted().joined(separator: ", "))")
            }
        }
        if let properties = fields["properties"] {
            guard case let .object(properties) = properties else {
                throw CommandError.schema("has \"properties\" that are no object")
            }
            for property in properties.values { try check(property) }
        }
        if let required = fields["required"] {
            guard case let .array(names) = required, names.allSatisfy({ name in if case .string = name { true } else { false } })
            else {
                throw CommandError.schema("has a \"required\" that is not a list of names")
            }
        }
        if let items = fields["items"] { try check(items) }
        if let choices = fields["enum"] {
            guard case let .array(values) = choices, !values.isEmpty else {
                throw CommandError.schema("has an \"enum\" that is not a list of values")
            }
        }
        if let choices = fields["oneOf"] {
            guard case let .array(choices) = choices, !choices.isEmpty else {
                throw CommandError.schema("has a \"oneOf\" that is not a list of { const, title }")
            }
            for choice in choices {
                guard case let .object(choice) = choice, choice["const"] != nil,
                    choice.keys.allSatisfy({ keyword in choiceKeywords.contains(keyword) })
                else {
                    throw CommandError.schema("has a \"oneOf\" that is not a list of { const, title }")
                }
            }
        }
    }

    // `schema` is one `check` took.
    private static func problem(of value: JSONValue, against schema: JSONValue, at path: String) -> String? {
        guard case let .object(fields) = schema else { return nil }
        if case let .string(type) = fields["type"], !isOfType(value, type) {
            return "\(path) is not \(type == "integer" || type == "array" || type == "object" ? "an" : "a") \(type)"
        }
        if case let .array(choices) = fields["enum"], !choices.contains(value) {
            return "\(path) is not one of what it takes"
        }
        if case let .array(choices) = fields["oneOf"] {
            let consts = choices.compactMap { choice in if case let .object(choice) = choice { choice["const"] } else { nil } }
            if !consts.contains(value) { return "\(path) is not one of what it takes" }
        }
        if case let .object(given) = value {
            if case let .array(required) = fields["required"] {
                for case let .string(name) in required where given[name] == nil {
                    return "\(path) needs \"\(name)\""
                }
            }
            if case let .object(properties) = fields["properties"] {
                for name in given.keys.sorted() {
                    guard let property = properties[name], let given = given[name] else { continue }
                    if let problem = problem(of: given, against: property, at: "\(path).\(name)") { return problem }
                }
            }
        }
        if case let .array(elements) = value, let items = fields["items"] {
            for (index, element) in elements.enumerated() {
                if let problem = problem(of: element, against: items, at: "\(path)[\(index)]") { return problem }
            }
        }

        return nil
    }

    private static func isOfType(_ value: JSONValue, _ type: String) -> Bool {
        switch (type, value) {
        case ("object", .object), ("array", .array), ("string", .string), ("number", .number), ("boolean", .bool):
            true

        case let ("integer", .number(number)):
            number.rounded() == number

        default:
            false
        }
    }
}
