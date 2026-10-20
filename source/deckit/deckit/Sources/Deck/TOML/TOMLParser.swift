//
//  TOMLParser.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The subset of TOML a manifest is written in: tables, bare and quoted keys, strings, integers, booleans and arrays.
// Anything else is refused by line.
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
    private let header = #/\[([A-Za-z0-9_-]+)\]/#
    private let bareKey = #/[A-Za-z0-9_-]+/#
    private let quotedKey = #/"(?:[^"\\]|\\.)*"/#
    // TOML reads a bare dotted key as a table inside a table; a dotted name is written in quotes.
    private let dottedKey = #/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+/#
    private let basicString = #/"(?:[^"\\]|\\.)*"/#
    private let literalString = #/'[^']*'/#
    private let boolean = #/(true|false)(?![A-Za-z0-9_])/#
    private let integer = #/[+-]?[0-9]+(?![A-Za-z0-9_.])/#
    // Arrays inside arrays, as deep as a manifest has any need for.
    private let depthLimit = 32

    // MARK: - Initializer
    // MARK: - Public
    func parse(_ text: String) throws(TOMLError) -> [String: TOMLValue] {
        var root: [String: TOMLValue] = [:]
        var table: String?
        let lines = String(text.trimmingPrefix("\u{FEFF}"))
            .components(separatedBy: "\n")
            .map { line in line.hasSuffix("\r") ? String(line.dropLast()) : line }

        var index = 0
        while index < lines.count {
            let line = index + 1
            let body = withoutComment(lines[index]).trimmingCharacters(in: .whitespaces)
            index += 1
            guard !body.isEmpty else { continue }

            if let match = body.wholeMatch(of: header) {
                let name = String(match.1)
                guard root[name] == nil else { throw TOMLError(line: line, reason: "[\(name)] appears twice") }

                root[name] = .table([:])
                table = name
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
            var values = if let table, case let .table(values) = root[table] { values } else { root }
            guard values[key] == nil else { throw TOMLError(line: line, reason: "\(key) is set twice") }

            var rest = String(body[body.index(after: equals)...])
            var depth = bracketDepth(rest)
            while depth > 0 && index < lines.count {
                let more = withoutComment(lines[index])
                index += 1
                depth += bracketDepth(more)
                rest += "\n" + more
            }

            var source = rest[...]
            values[key] = try value(in: &source, depth: 0, line: line)
            guard source.allSatisfy(\.isWhitespace) else {
                throw TOMLError(line: line, reason: "unexpected text after the value of \(key)")
            }

            if let table {
                root[table] = .table(values)
            } else {
                root = values
            }
        }

        return root
    }

    // MARK: - Private
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
