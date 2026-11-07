//
//  TOMLParser.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The language based on TOML a manifest is written in: tables and arrays of tables, under headers of bare and quoted
// keys, bare and quoted keys, strings, integers, booleans, arrays and inline tables. Anything else is refused by line.
// The text is read as Unicode scalar values, not as the characters they make up. White space is each scalar value of
// the property White_Space but LF, which ends a line, and between the values of an array or an inline table LF too.
struct TOMLParser {
    // MARK: - Property
    private let escapes: [Unicode.Scalar: Unicode.Scalar] = [
        "n": "\n",
        "t": "\t",
        "r": "\r",
        "b": "\u{8}",
        "f": "\u{C}",
        "\"": "\"",
        "\\": "\\"
    ]
    private let tableHeader = #/\[([^\[\]].*)\]/#.dotMatchesNewlines().matchingSemantics(.unicodeScalar)
    private let arrayHeader = #/\[\[(.+)\]\]/#.dotMatchesNewlines().matchingSemantics(.unicodeScalar)
    private let bareKey = #/[A-Za-z0-9_-]+/#.matchingSemantics(.unicodeScalar)
    private let quotedKey = #/"(?:[^"\\]|\\.)*"/#.dotMatchesNewlines().matchingSemantics(.unicodeScalar)
    // TOML reads a bare dotted key as a table inside a table; a dotted name is written in quotes.
    private let dottedKey = #/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+/#.matchingSemantics(.unicodeScalar)
    private let basicString = #/"(?:[^"\\]|\\.)*"/#.dotMatchesNewlines().matchingSemantics(.unicodeScalar)
    private let literalString = #/'[^']*'/#.matchingSemantics(.unicodeScalar)
    private let boolean = #/(true|false)(?![A-Za-z0-9_])/#.matchingSemantics(.unicodeScalar)
    private let integer = #/[+-]?[0-9]+(?![A-Za-z0-9_.])/#.matchingSemantics(.unicodeScalar)
    // Arrays and inline tables inside each other, as deep as a manifest has any need for.
    private let depthLimit = 32

    // MARK: - Initializer
    // MARK: - Public
    func parse(_ text: String) throws(TOMLError) -> [TOMLKey: TOMLValue] {
        var root: [TOMLKey: TOMLValue] = [:]
        // The keys of the table the lines below the last header set, from the root.
        var table: [TOMLKey] = []
        // The tables a header named, and the arrays of tables, by their keys from the root.
        var defined: Set<[TOMLKey]> = []
        var arrays: Set<[TOMLKey]> = []
        let unmarked = starts(text[...], with: "\u{FEFF}") ? String(afterFirst(text[...])) : text
        let lines = unmarked
            .components(separatedBy: "\n")
            .map { line in line.unicodeScalars.last == "\r" ? String(Substring(line.unicodeScalars.dropLast())) : line }

        var index = 0
        while index < lines.count {
            let line = index + 1
            let body = trimmed(withoutComment(lines[index]))
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
                        throw TOMLError(line: line, reason: "\(key.text) is set as a value, not as \(body)")
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

            guard let equals = body.unicodeScalars.firstIndex(of: "=") else {
                throw TOMLError(line: line, reason: "expected key = value")
            }
            let rawKey = trimmed(body[..<equals])
            guard rawKey.wholeMatch(of: dottedKey) == nil else {
                throw TOMLError(line: line, reason: "a name with a dot is written in quotes: \"\(rawKey)\" = …")
            }
            guard rawKey.wholeMatch(of: bareKey) != nil || rawKey.wholeMatch(of: quotedKey) != nil else {
                throw TOMLError(line: line, reason: "not a key this reads: \(rawKey)")
            }
            let key = try self.key(rawKey, line: line)

            var rest = String(body[body.unicodeScalars.index(after: equals)...])
            var depth = bracketDepth(rest)
            while depth > 0 && index < lines.count {
                let more = String(withoutComment(lines[index]))
                index += 1
                depth += bracketDepth(more)
                rest += "\n" + more
            }

            var source = dropping(rest[...], while: isSpace)
            let value = try value(in: &source, depth: 0, line: line)
            guard source.unicodeScalars.allSatisfy(isSpace) else {
                throw TOMLError(line: line, reason: "unexpected text after the value of \(key.text)")
            }

            try change(&root, at: table[...], line: line) { values throws(TOMLError) in
                guard values[key] == nil else { throw TOMLError(line: line, reason: "\(key.text) is set twice") }
                values[key] = value
            }
        }

        return root
    }

    // MARK: - Private
    // The keys a header names, `a."b/c"`, each bare or quoted, apart at dots.
    private func keys(of header: Substring, line: Int) throws(TOMLError) -> [TOMLKey] {
        var keys: [TOMLKey] = []
        var source = dropping(header, while: isSpace)
        while true {
            guard let match = source.prefixMatch(of: quotedKey) ?? source.prefixMatch(of: bareKey) else {
                throw TOMLError(line: line, reason: "not a header this reads: [\(header)]")
            }
            keys.append(try key(match.output, line: line))
            source = dropping(source[match.range.upperBound...], while: isSpace)
            guard !source.isEmpty else { return keys }
            guard starts(source, with: ".") else {
                throw TOMLError(line: line, reason: "not a header this reads: [\(header)]")
            }
            source = dropping(afterFirst(source), while: isSpace)
        }
    }

    // `change` made to the table `path` names inside `values`, each table on the way made where it is not there: a
    // key that holds an array of tables goes on in its last.
    private func change(
        _ values: inout [TOMLKey: TOMLValue],
        at path: ArraySlice<TOMLKey>,
        line: Int,
        _ change: (inout [TOMLKey: TOMLValue]) throws(TOMLError) -> Void
    ) throws(TOMLError) {
        guard let key = path.first else {
            try change(&values)
            return
        }

        switch values[key] {
        case .none:
            var table: [TOMLKey: TOMLValue] = [:]
            try self.change(&table, at: path.dropFirst(), line: line, change)
            values[key] = .table(table)

        case var .table(table)?:
            try self.change(&table, at: path.dropFirst(), line: line, change)
            values[key] = .table(table)

        case var .array(tables)?:
            guard case var .table(last)? = tables.last else {
                throw TOMLError(line: line, reason: "\(key.text) is set as a value, not as a table")
            }
            try self.change(&last, at: path.dropFirst(), line: line, change)
            tables[tables.count - 1] = .table(last)
            values[key] = .array(tables)

        default:
            throw TOMLError(line: line, reason: "\(key.text) is set as a value, not as a table")
        }
    }

    // The value `source` starts with, taken off it.
    private func value(in source: inout Substring, depth: Int, line: Int) throws(TOMLError) -> TOMLValue {
        if let match = source.prefixMatch(of: basicString) ?? source.prefixMatch(of: literalString) {
            source = source[match.range.upperBound...]
            return .string(try unquote(match.output, line: line))
        }
        if let match = source.prefixMatch(of: boolean) {
            source = source[match.range.upperBound...]
            return .boolean(match.1 == "true")
        }
        if let match = source.prefixMatch(of: integer) {
            let bound = Int.largestInManifest
            guard let number = Int(match.output), (-bound ... bound).contains(number) else {
                throw TOMLError(line: line, reason: "an integer lies from -\(bound) to \(bound), not \(match.output)")
            }

            source = source[match.range.upperBound...]
            return .integer(number)
        }
        if starts(source, with: "[") {
            guard depth < depthLimit else {
                throw TOMLError(line: line, reason: "arrays nest at most \(depthLimit) deep")
            }
            return try array(in: &source, depth: depth + 1, line: line)
        }
        if starts(source, with: "{") {
            guard depth < depthLimit else {
                throw TOMLError(line: line, reason: "inline tables nest at most \(depthLimit) deep")
            }
            return try inlineTable(in: &source, depth: depth + 1, line: line)
        }

        let shown = Substring(source.unicodeScalars.prefix { scalar in scalar != "\n" }.prefix(40))
        throw TOMLError(line: line, reason: "not a value this reads: \(shown)")
    }

    private func array(in source: inout Substring, depth: Int, line: Int) throws(TOMLError) -> TOMLValue {
        var values: [TOMLValue] = []
        source = dropping(afterFirst(source), while: isSpaceOrLineFeed)
        while !starts(source, with: "]") {
            values.append(try value(in: &source, depth: depth, line: line))
            source = dropping(source, while: isSpaceOrLineFeed)
            if starts(source, with: ",") {
                source = dropping(afterFirst(source), while: isSpaceOrLineFeed)
            } else if !starts(source, with: "]") {
                throw TOMLError(line: line, reason: "expected , or ] in an array")
            }
        }
        source = afterFirst(source)

        return .array(values)
    }

    // `{ key = value, … }`, with no , before its }.
    private func inlineTable(in source: inout Substring, depth: Int, line: Int) throws(TOMLError) -> TOMLValue {
        var values: [TOMLKey: TOMLValue] = [:]
        source = dropping(afterFirst(source), while: isSpaceOrLineFeed)
        while !starts(source, with: "}") {
            guard let match = source.prefixMatch(of: quotedKey) ?? source.prefixMatch(of: bareKey) else {
                throw TOMLError(line: line, reason: "expected a key in an inline table")
            }
            source = dropping(source[match.range.upperBound...], while: isSpaceOrLineFeed)
            guard starts(source, with: "=") else {
                throw TOMLError(line: line, reason: "expected = after \(match.output) in an inline table")
            }
            source = dropping(afterFirst(source), while: isSpaceOrLineFeed)
            let key = try self.key(match.output, line: line)
            guard values[key] == nil else { throw TOMLError(line: line, reason: "\(key.text) is set twice") }

            values[key] = try value(in: &source, depth: depth, line: line)
            source = dropping(source, while: isSpaceOrLineFeed)
            if starts(source, with: ",") {
                source = dropping(afterFirst(source), while: isSpaceOrLineFeed)
                guard !starts(source, with: "}") else {
                    throw TOMLError(line: line, reason: "an inline table ends with no , before }")
                }
            } else if !starts(source, with: "}") {
                throw TOMLError(line: line, reason: "expected , or } in an inline table")
            }
        }
        source = afterFirst(source)

        return .table(values)
    }

    // A key as it is written bare, or the string a quoted one gives.
    private func key(_ raw: Substring, line: Int) throws(TOMLError) -> TOMLKey {
        TOMLKey(starts(raw, with: "\"") ? try unquote(raw, line: line) : String(raw))
    }

    // A basic string takes backslash escapes, a literal one does not.
    private func unquote(_ raw: Substring, line: Int) throws(TOMLError) -> String {
        var scalars = raw.unicodeScalars.dropFirst().dropLast()
        guard starts(raw, with: "\"") else { return String(Substring(scalars)) }

        var text = String.UnicodeScalarView()
        while let scalar = scalars.popFirst() {
            guard scalar == "\\" else {
                text.append(scalar)
                continue
            }

            let escape = scalars.popFirst() ?? "\\"
            if escape == "u" || escape == "U" {
                let count = escape == "u" ? 4 : 8
                let digits = scalars.prefix(count)
                if digits.count == count,
                    digits.allSatisfy(\.properties.isASCIIHexDigit),
                    let code = UInt32(String(Substring(digits)), radix: 16),
                    let value = Unicode.Scalar(code)
                {
                    text.append(value)
                    scalars = scalars.dropFirst(count)
                    continue
                }
            }
            guard let replacement = escapes[escape] else {
                throw TOMLError(line: line, reason: "unknown escape \\\(escape)")
            }

            text.append(replacement)
        }

        return String(text)
    }

    private func withoutComment(_ text: String) -> Substring {
        guard let at = outsideStrings(text, { scalar in scalar == "#" }) else { return text[...] }
        return text[..<at]
    }

    private func bracketDepth(_ text: String) -> Int {
        var depth = 0
        _ = outsideStrings(text) { scalar in
            if scalar == "[" {
                depth += 1
            } else if scalar == "]" {
                depth -= 1
            }
            return false
        }

        return depth
    }

    // Visits each scalar value outside a string, and answers where `visit` answered true, if it did.
    private func outsideStrings(_ text: String, _ visit: (Unicode.Scalar) -> Bool) -> String.Index? {
        var quote: Unicode.Scalar?
        var escaped = false
        for index in text.unicodeScalars.indices {
            let scalar = text.unicodeScalars[index]
            if let open = quote {
                if escaped {
                    escaped = false
                } else if scalar == "\\" && open == "\"" {
                    escaped = true
                } else if scalar == open {
                    quote = nil
                }
            } else if scalar == "\"" || scalar == "'" {
                quote = scalar
            } else if visit(scalar) {
                return index
            }
        }

        return nil
    }

    // `ws`: a scalar value of the property White_Space, but LF.
    private func isSpace(_ scalar: Unicode.Scalar) -> Bool {
        scalar != "\n" && scalar.properties.isWhitespace
    }

    // `vs`: white space or LF, as between the values of an array or an inline table.
    private func isSpaceOrLineFeed(_ scalar: Unicode.Scalar) -> Bool {
        scalar.properties.isWhitespace
    }

    // `text` without the white space at its ends.
    private func trimmed(_ text: Substring) -> Substring {
        let scalars = text.unicodeScalars.drop(while: isSpace)
        guard let last = scalars.lastIndex(where: { scalar in !isSpace(scalar) }) else { return "" }

        return Substring(scalars[...last])
    }

    private func dropping(_ text: Substring, while dropped: (Unicode.Scalar) -> Bool) -> Substring {
        Substring(text.unicodeScalars.drop(while: dropped))
    }

    private func starts(_ text: Substring, with scalar: Unicode.Scalar) -> Bool {
        text.unicodeScalars.first == scalar
    }

    // `text` from its second scalar value on.
    private func afterFirst(_ text: Substring) -> Substring {
        Substring(text.unicodeScalars.dropFirst())
    }
}
