//
//  TOMLParser.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The subset of TOML a manifest is written in: tables and arrays of tables, under headers of bare and quoted keys,
// bare and quoted keys, strings, integers, booleans, arrays and inline tables. Anything else is refused by line.
struct TOMLParser {
    // MARK: - Property
    private let escapes: [Character: Character] = [
        "n": "\n",
        "t": "\t",
        "r": "\r",
        "b": "\u{8}",
        "f": "\u{C}",
        "\"": "\"",
        "\\": "\\"
    ]
    private let tableHeader = #/\[([^\[\]].*)\]/#
    private let arrayHeader = #/\[\[(.+)\]\]/#
    private let bareKey = #/[A-Za-z0-9_-]+/#
    private let quotedKey = #/"(?:[^"\\]|\\.)*"/#
    // TOML reads a bare dotted key as a table inside a table; a dotted name is written in quotes.
    private let dottedKey = #/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+/#
    private let basicString = #/"(?:[^"\\]|\\.)*"/#
    private let literalString = #/'[^']*'/#
    private let boolean = #/(true|false)(?![A-Za-z0-9_])/#
    private let integer = #/[+-]?[0-9]+(?![A-Za-z0-9_.])/#
    // Arrays and inline tables inside each other, as deep as a manifest has any need for.
    private let depthLimit = 32

    // MARK: - Initializer
    // MARK: - Public
    func parse(_ text: String) throws(TOMLError) -> [String: TOMLValue] {
        var root: [String: TOMLValue] = [:]
        // The keys of the table the lines below the last header set, from the root.
        var table: [String] = []
        // The tables a header named, and the arrays of tables, by their keys from the root.
        var defined: Set<[String]> = []
        var arrays: Set<[String]> = []
        let lines = String(text.trimmingPrefix("\u{FEFF}"))
            .components(separatedBy: "\n")
            .map { line in line.hasSuffix("\r") ? String(line.dropLast()) : line }

        var index = 0
        while index < lines.count {
            let line = index + 1
            let body = withoutComment(lines[index]).trimmingCharacters(in: .whitespaces)
            index += 1
            guard !body.isEmpty else { continue }

            if let match = body.wholeMatch(of: arrayHeader) {
                let path = try keys(of: match.1, line: line)
                guard !defined.contains(path) else { throw TOMLError(line: line, reason: "\(body) appears twice") }

                try change(&root, at: path.dropLast(), line: line) { values throws(TOMLError) in
                    let key = path[path.count - 1]
                    switch values[key] {
                    case .none:
                        values[key] = .array([.table([:])])

                    case let .array(tables)? where arrays.contains(path):
                        values[key] = .array(tables + [.table([:])])

                    default:
                        throw TOMLError(line: line, reason: "\(key) is set as a value, not as \(body)")
                    }
                }
                arrays.insert(path)
                defined = defined.filter { named in !named.starts(with: path) }
                table = path
                continue
            }
            if let match = body.wholeMatch(of: tableHeader) {
                let path = try keys(of: match.1, line: line)
                guard !arrays.contains(path), defined.insert(path).inserted else {
                    throw TOMLError(line: line, reason: "\(body) appears twice")
                }

                try change(&root, at: path[...], line: line) { _ throws(TOMLError) in }
                table = path
                continue
            }

            guard let equals = body.firstIndex(of: "=") else {
                throw TOMLError(line: line, reason: "expected key = value")
            }
            let rawKey = body[..<equals].trimmingCharacters(in: .whitespaces)
            guard rawKey.wholeMatch(of: dottedKey) == nil else {
                throw TOMLError(line: line, reason: "a name with a dot is written in quotes: \"\(rawKey)\" = …")
            }
            guard rawKey.wholeMatch(of: bareKey) != nil || rawKey.wholeMatch(of: quotedKey) != nil else {
                throw TOMLError(line: line, reason: "not a key this reads: \(rawKey)")
            }
            let key = rawKey.hasPrefix("\"") ? try unquote(rawKey, line: line) : rawKey

            var rest = String(body[body.index(after: equals)...])
            var depth = bracketDepth(rest)
            while depth > 0 && index < lines.count {
                let more = withoutComment(lines[index])
                index += 1
                depth += bracketDepth(more)
                rest += "\n" + more
            }

            var source = rest[...]
            let value = try value(in: &source, depth: 0, line: line)
            guard source.allSatisfy(\.isWhitespace) else {
                throw TOMLError(line: line, reason: "unexpected text after the value of \(key)")
            }

            try change(&root, at: table[...], line: line) { values throws(TOMLError) in
                guard values[key] == nil else { throw TOMLError(line: line, reason: "\(key) is set twice") }
                values[key] = value
            }
        }

        return root
    }

    // MARK: - Private
    // The keys a header names, `a."b/c"`, each bare or quoted, apart at dots.
    private func keys(of header: Substring, line: Int) throws(TOMLError) -> [String] {
        var keys: [String] = []
        var source = header.drop(while: \.isWhitespace)
        while true {
            guard let match = source.prefixMatch(of: quotedKey) ?? source.prefixMatch(of: bareKey) else {
                throw TOMLError(line: line, reason: "not a header this reads: [\(header)]")
            }
            let rawKey = String(match.output)
            keys.append(rawKey.hasPrefix("\"") ? try unquote(rawKey, line: line) : rawKey)
            source = source[match.range.upperBound...].drop(while: \.isWhitespace)
            guard !source.isEmpty else { return keys }
            guard source.hasPrefix(".") else {
                throw TOMLError(line: line, reason: "not a header this reads: [\(header)]")
            }
            source = source.dropFirst().drop(while: \.isWhitespace)
        }
    }

    // `change` made to the table `path` names inside `values`, each table on the way made where it is not there: a
    // key that holds an array of tables goes on in its last.
    private func change(
        _ values: inout [String: TOMLValue],
        at path: ArraySlice<String>,
        line: Int,
        _ change: (inout [String: TOMLValue]) throws(TOMLError) -> Void
    ) throws(TOMLError) {
        guard let key = path.first else {
            try change(&values)
            return
        }

        switch values[key] {
        case .none:
            var table: [String: TOMLValue] = [:]
            try self.change(&table, at: path.dropFirst(), line: line, change)
            values[key] = .table(table)

        case var .table(table)?:
            try self.change(&table, at: path.dropFirst(), line: line, change)
            values[key] = .table(table)

        case var .array(tables)?:
            guard case var .table(last)? = tables.last else {
                throw TOMLError(line: line, reason: "\(key) is set as a value, not as a table")
            }
            try self.change(&last, at: path.dropFirst(), line: line, change)
            tables[tables.count - 1] = .table(last)
            values[key] = .array(tables)

        default:
            throw TOMLError(line: line, reason: "\(key) is set as a value, not as a table")
        }
    }

    // The value `source` starts with, taken off it.
    private func value(in source: inout Substring, depth: Int, line: Int) throws(TOMLError) -> TOMLValue {
        source = source.drop(while: \.isWhitespace)
        if let match = source.prefixMatch(of: basicString) ?? source.prefixMatch(of: literalString) {
            source = source[match.range.upperBound...]
            return .string(try unquote(String(match.output), line: line))
        }
        if let match = source.prefixMatch(of: boolean) {
            source = source[match.range.upperBound...]
            return .boolean(match.1 == "true")
        }
        if let match = source.prefixMatch(of: integer), let number = Int(match.output) {
            source = source[match.range.upperBound...]
            return .integer(number)
        }
        if source.hasPrefix("[") {
            guard depth < depthLimit else {
                throw TOMLError(line: line, reason: "arrays nest at most \(depthLimit) deep")
            }
            return try array(in: &source, depth: depth + 1, line: line)
        }
        if source.hasPrefix("{") {
            guard depth < depthLimit else {
                throw TOMLError(line: line, reason: "inline tables nest at most \(depthLimit) deep")
            }
            return try inlineTable(in: &source, depth: depth + 1, line: line)
        }

        let shown = source.prefix { character in !character.isNewline }.prefix(40)
        throw TOMLError(line: line, reason: "not a value this reads: \(shown)")
    }

    private func array(in source: inout Substring, depth: Int, line: Int) throws(TOMLError) -> TOMLValue {
        var values: [TOMLValue] = []
        source = source.dropFirst().drop(while: \.isWhitespace)
        while !source.hasPrefix("]") {
            values.append(try value(in: &source, depth: depth, line: line))
            source = source.drop(while: \.isWhitespace)
            if source.hasPrefix(",") {
                source = source.dropFirst().drop(while: \.isWhitespace)
            } else if !source.hasPrefix("]") {
                throw TOMLError(line: line, reason: "expected , or ] in an array")
            }
        }
        source = source.dropFirst()

        return .array(values)
    }

    // `{ key = value, … }` on one line, as TOML writes an inline table.
    private func inlineTable(in source: inout Substring, depth: Int, line: Int) throws(TOMLError) -> TOMLValue {
        var values: [String: TOMLValue] = [:]
        source = source.dropFirst().drop(while: \.isWhitespace)
        while !source.hasPrefix("}") {
            guard let match = source.prefixMatch(of: quotedKey) ?? source.prefixMatch(of: bareKey) else {
                throw TOMLError(line: line, reason: "expected a key in an inline table")
            }
            let rawKey = String(match.output)
            source = source[match.range.upperBound...].drop(while: \.isWhitespace)
            guard source.hasPrefix("=") else {
                throw TOMLError(line: line, reason: "expected = after \(rawKey) in an inline table")
            }
            source = source.dropFirst()
            let key = rawKey.hasPrefix("\"") ? try unquote(rawKey, line: line) : rawKey
            guard values[key] == nil else { throw TOMLError(line: line, reason: "\(key) is set twice") }

            values[key] = try value(in: &source, depth: depth, line: line)
            source = source.drop(while: \.isWhitespace)
            if source.hasPrefix(",") {
                source = source.dropFirst().drop(while: \.isWhitespace)
                guard !source.hasPrefix("}") else {
                    throw TOMLError(line: line, reason: "an inline table ends with no , before }")
                }
            } else if !source.hasPrefix("}") {
                throw TOMLError(line: line, reason: "expected , or } in an inline table")
            }
        }
        source = source.dropFirst()

        return .table(values)
    }

    // A basic string takes backslash escapes, a literal one does not.
    private func unquote(_ raw: String, line: Int) throws(TOMLError) -> String {
        guard raw.hasPrefix("\"") else { return String(raw.dropFirst().dropLast()) }

        var text = ""
        var characters = raw.dropFirst().dropLast()
        while let character = characters.popFirst() {
            guard character == "\\" else {
                text.append(character)
                continue
            }

            let escape = characters.popFirst() ?? "\\"
            if escape == "u" || escape == "U" {
                let digits = characters.prefix(escape == "u" ? 4 : 8)
                if digits.count == (escape == "u" ? 4 : 8),
                    let code = UInt32(String(digits), radix: 16),
                    let scalar = Unicode.Scalar(code)
                {
                    text.unicodeScalars.append(scalar)
                    characters = characters.dropFirst(digits.count)
                    continue
                }
            }
            guard let replacement = escapes[escape] else {
                throw TOMLError(line: line, reason: "unknown escape \\\(escape)")
            }

            text.append(replacement)
        }

        return text
    }

    private func withoutComment(_ text: String) -> String {
        guard let at = outsideStrings(text, { character in character == "#" }) else { return text }
        return String(text[..<at])
    }

    private func bracketDepth(_ text: String) -> Int {
        var depth = 0
        _ = outsideStrings(text) { character in
            if character == "[" {
                depth += 1
            } else if character == "]" {
                depth -= 1
            }
            return false
        }

        return depth
    }

    // Visits each character outside a string, and answers where `visit` answered true, if it did.
    private func outsideStrings(_ text: String, _ visit: (Character) -> Bool) -> String.Index? {
        var quote: Character?
        var escaped = false
        for index in text.indices {
            let character = text[index]
            if let open = quote {
                if escaped {
                    escaped = false
                } else if character == "\\" && open == "\"" {
                    escaped = true
                } else if character == open {
                    quote = nil
                }
            } else if character == "\"" || character == "'" {
                quote = character
            } else if visit(character) {
                return index
            }
        }

        return nil
    }
}
