//
//  JSONValue+Reading.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension JSONValue {
    // MARK: - Property
    var array: [JSONValue] {
        guard case let .array(values) = self else { return [] }
        return values
    }

    var string: String? {
        guard case let .string(value) = self else { return nil }
        return value
    }

    var bool: Bool? {
        guard case let .bool(value) = self else { return nil }
        return value
    }

    // Of effects, the bindings the last `bindingsChanged` tells, or nil when none does.
    var bindingsChanged: JSONValue? {
        array.last { effect in effect["effect"]?.string == "bindingsChanged" }?["bindings"]
    }

    // MARK: - Initializer
    // MARK: - Public
    subscript(_ key: String) -> JSONValue? {
        guard case let .object(fields) = self else { return nil }
        return fields[key]
    }

    // Of bindings, the binding of `id` as a test compares it: `id active kind:other ...`.
    func line(of id: String) -> String? {
        guard let binding = array.first(where: { binding in binding["id"]?.string == id }) else { return nil }
        let issues = (binding["issues"]?.array ?? []).compactMap { issue in
            issue["kind"]?.string.map { kind in kind + ":" + (issue["other"]?["id"]?.string ?? "") }
        }

        return ([id, binding["active"]?.bool == true ? "active" : "inactive"] + issues).joined(separator: " ")
    }

    // MARK: - Private
}
