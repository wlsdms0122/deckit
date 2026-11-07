//
//  JSONWriter.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// A value as JSON text, each member of an object under its own name, two names of one canonical form as two, and the
// members of an object in a fixed order of their names. `options` lay the text out: compact with none.
package struct JSONWriter {
    // MARK: - Property
    private let options: JSONSerialization.WritingOptions

    // MARK: - Initializer
    package init(options: JSONSerialization.WritingOptions = []) {
        self.options = options.union([.sortedKeys, .fragmentsAllowed])
    }

    // MARK: - Public
    package func write(_ value: any Encodable) throws -> Data {
        let node = JSONNode()
        try value.encode(to: JSONNodeEncoder(node: node, codingPath: []))
        return try JSONSerialization.data(withJSONObject: object(of: node), options: options)
    }

    // MARK: - Private
    // The node as JSONSerialization writes it. An object is an NSMutableDictionary, which holds two names apart while
    // their UTF-16 code units differ, and a node that holds nothing is an empty object.
    private func object(of node: JSONNode) -> Any {
        switch node.content {
        case .null:
            return NSNull()

        case let .bool(value):
            return NSNumber(value: value)

        case let .number(value):
            return value

        case let .string(value):
            return value

        case let .array(nodes):
            return nodes.map(object(of:))

        case let .object(nodes):
            let members = NSMutableDictionary()
            for (name, node) in nodes {
                members[name.text] = object(of: node)
            }
            return members

        case .empty:
            return NSDictionary()
        }
    }
}
