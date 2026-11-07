//
//  JSONWriter.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// A value as JSON text, each member of an object under its own name, two names of one canonical form as two. Members
// come in the order of their names, and the text is laid out as Foundation's JSONEncoder lays it out: compact, or
// pretty, two spaces deep a level and a name ` : ` its value.
package struct JSONWriter {
    // MARK: - Property
    private let pretty: Bool
    // Whether "/" is written "\/".
    private let escapesSlashes: Bool

    // MARK: - Initializer
    package init(pretty: Bool = false, escapesSlashes: Bool = true) {
        self.pretty = pretty
        self.escapesSlashes = escapesSlashes
    }

    // MARK: - Public
    package func write(_ value: any Encodable) throws -> Data {
        let node = JSONNode()
        try value.encode(to: JSONNodeEncoder(node: node, codingPath: []))
        return Data(text(of: node, depth: 0).utf8)
    }

    // MARK: - Private
    // A node that holds nothing is an empty object.
    private func text(of node: JSONNode, depth: Int) -> String {
        switch node.content {
        case .null:
            return "null"

        case let .bool(value):
            return value ? "true" : "false"

        case let .number(written):
            return written

        case let .string(value):
            return quoted(value)

        case let .array(nodes):
            return enclosed(nodes.map { node in text(of: node, depth: depth + 1) }, in: ("[", "]"), depth: depth)

        case let .object(nodes):
            let members = nodes.sorted { one, other in one.key < other.key }.map { name, node in
                quoted(name.text) + (pretty ? " : " : ":") + text(of: node, depth: depth + 1)
            }
            return enclosed(members, in: ("{", "}"), depth: depth)

        case .empty:
            return enclosed([], in: ("{", "}"), depth: depth)
        }
    }

    private func enclosed(_ parts: [String], in brackets: (open: String, close: String), depth: Int) -> String {
        guard pretty else { return brackets.open + parts.joined(separator: ",") + brackets.close }

        let indent = String(repeating: "  ", count: depth)
        let inner = indent + "  "
        let lines = parts.map { part in inner + part }.joined(separator: ",\n")
        return brackets.open + "\n" + lines + "\n" + indent + brackets.close
    }

    // `"`, `\`, and a control character escaped, each but those of a short escape as `\u` and four hex digits.
    private func quoted(_ text: String) -> String {
        var written = String.UnicodeScalarView()
        written.append("\"")
        for scalar in text.unicodeScalars {
            switch scalar {
            case "\"":
                written.append(contentsOf: #"\""#.unicodeScalars)

            case "\\":
                written.append(contentsOf: #"\\"#.unicodeScalars)

            case "/" where escapesSlashes:
                written.append(contentsOf: #"\/"#.unicodeScalars)

            case "\n":
                written.append(contentsOf: #"\n"#.unicodeScalars)

            case "\r":
                written.append(contentsOf: #"\r"#.unicodeScalars)

            case "\t":
                written.append(contentsOf: #"\t"#.unicodeScalars)

            case "\u{8}":
                written.append(contentsOf: #"\b"#.unicodeScalars)

            case "\u{C}":
                written.append(contentsOf: #"\f"#.unicodeScalars)

            case let scalar where scalar.value < 0x20:
                let digits = String(scalar.value, radix: 16)
                let escape = #"\u"# + String(repeating: "0", count: 4 - digits.count) + digits
                written.append(contentsOf: escape.unicodeScalars)

            default:
                written.append(scalar)
            }
        }
        written.append("\"")

        return String(written)
    }
}
