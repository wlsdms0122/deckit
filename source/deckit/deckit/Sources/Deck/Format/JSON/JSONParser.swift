//
//  JSONParser.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// The value a JSON text writes, each member of an object under its own name, two names of one canonical form as two.
// A name an object writes twice keeps its last value. Text that is not one JSON value, with white space around it,
// throws `DecodingError.dataCorrupted`, and so does a value nested more than 512 deep.
package struct JSONParser {
    // MARK: - Property
    private let depthLimit = 512

    // MARK: - Initializer
    package init() {}

    // MARK: - Public
    package func parse(_ text: String) throws -> JSONValue {
        let scalars = Array(text.unicodeScalars)
        var place = 0
        let value = try self.value(in: scalars, at: &place, depth: 0)
        skipSpace(in: scalars, at: &place)
        guard place == scalars.count else { throw failure("text after the value", at: place) }

        return value
    }

    // MARK: - Private
    private func value(in scalars: [Unicode.Scalar], at place: inout Int, depth: Int) throws -> JSONValue {
        skipSpace(in: scalars, at: &place)
        guard place < scalars.count else { throw failure("no value", at: place) }

        switch scalars[place] {
        case "{":
            return try object(in: scalars, at: &place, depth: depth + 1)

        case "[":
            return try array(in: scalars, at: &place, depth: depth + 1)

        case "\"":
            return .string(try string(in: scalars, at: &place))

        case "t":
            try literal("true", in: scalars, at: &place)
            return .bool(true)

        case "f":
            try literal("false", in: scalars, at: &place)
            return .bool(false)

        case "n":
            try literal("null", in: scalars, at: &place)
            return .null

        case "-", "0"..."9":
            return .number(try number(in: scalars, at: &place))

        default:
            throw failure("no value", at: place)
        }
    }

    private func object(in scalars: [Unicode.Scalar], at place: inout Int, depth: Int) throws -> JSONValue {
        guard depth <= depthLimit else { throw failure("an object nested too deep", at: place) }

        place += 1
        var members: [JSONName: JSONValue] = [:]
        skipSpace(in: scalars, at: &place)
        if place < scalars.count, scalars[place] == "}" {
            place += 1
            return .object(members)
        }
        while true {
            skipSpace(in: scalars, at: &place)
            guard place < scalars.count, scalars[place] == "\"" else { throw failure("no name", at: place) }
            let name = JSONName(try string(in: scalars, at: &place))
            skipSpace(in: scalars, at: &place)
            guard place < scalars.count, scalars[place] == ":" else { throw failure("no \":\"", at: place) }
            place += 1
            members[name] = try value(in: scalars, at: &place, depth: depth)
            skipSpace(in: scalars, at: &place)
            guard place < scalars.count else { throw failure("an object not closed", at: place) }

            place += 1
            switch scalars[place - 1] {
            case ",":
                continue

            case "}":
                return .object(members)

            default:
                throw failure("no \",\" or \"}\"", at: place - 1)
            }
        }
    }

    private func array(in scalars: [Unicode.Scalar], at place: inout Int, depth: Int) throws -> JSONValue {
        guard depth <= depthLimit else { throw failure("an array nested too deep", at: place) }

        place += 1
        var items: [JSONValue] = []
        skipSpace(in: scalars, at: &place)
        if place < scalars.count, scalars[place] == "]" {
            place += 1
            return .array(items)
        }
        while true {
            items.append(try value(in: scalars, at: &place, depth: depth))
            skipSpace(in: scalars, at: &place)
            guard place < scalars.count else { throw failure("an array not closed", at: place) }

            place += 1
            switch scalars[place - 1] {
            case ",":
                continue

            case "]":
                return .array(items)

            default:
                throw failure("no \",\" or \"]\"", at: place - 1)
            }
        }
    }

    // From its opening `"` to its closing one, a `\u` escape of a surrogate only as the first of a pair.
    private func string(in scalars: [Unicode.Scalar], at place: inout Int) throws -> String {
        let start = place
        place += 1
        var text = String.UnicodeScalarView()
        while place < scalars.count {
            let scalar = scalars[place]
            place += 1
            switch scalar {
            case "\"":
                return String(text)

            case "\\":
                text.append(try escaped(in: scalars, at: &place))

            case let scalar where scalar.value < 0x20:
                throw failure("a control character in a string", at: place - 1)

            default:
                text.append(scalar)
            }
        }

        throw failure("a string not closed", at: start)
    }

    // The scalar an escape after its `\` gives.
    private func escaped(in scalars: [Unicode.Scalar], at place: inout Int) throws -> Unicode.Scalar {
        guard place < scalars.count else { throw failure("an escape not finished", at: place) }

        let letter = scalars[place]
        place += 1
        switch letter {
        case "\"", "\\", "/":
            return letter

        case "b":
            return "\u{8}"

        case "f":
            return "\u{C}"

        case "n":
            return "\n"

        case "r":
            return "\r"

        case "t":
            return "\t"

        case "u":
            let unit = try codeUnit(in: scalars, at: &place)
            if let scalar = Unicode.Scalar(unit) {
                return scalar
            }
            guard (0xD800...0xDBFF).contains(unit),
                place + 1 < scalars.count,
                scalars[place] == "\\",
                scalars[place + 1] == "u"
            else {
                throw failure("a surrogate not of a pair", at: place)
            }
            place += 2
            let low = try codeUnit(in: scalars, at: &place)
            guard (0xDC00...0xDFFF).contains(low),
                let scalar = Unicode.Scalar(0x10000 + (UInt32(unit) - 0xD800) << 10 + (UInt32(low) - 0xDC00))
            else {
                throw failure("a surrogate not of a pair", at: place)
            }
            return scalar

        default:
            throw failure("no such escape", at: place - 1)
        }
    }

    // Four hex digits.
    private func codeUnit(in scalars: [Unicode.Scalar], at place: inout Int) throws -> UInt16 {
        guard place + 4 <= scalars.count,
            let unit = UInt16(String(String.UnicodeScalarView(scalars[place..<place + 4])), radix: 16),
            scalars[place..<place + 4].allSatisfy(\.properties.isASCIIHexDigit)
        else {
            throw failure("no four hex digits", at: place)
        }
        place += 4

        return unit
    }

    // `-`, then `0` or digits that do not begin with it, then a fraction and an exponent where written, of a finite
    // Double.
    private func number(in scalars: [Unicode.Scalar], at place: inout Int) throws -> Double {
        let start = place
        if scalars[place] == "-" {
            place += 1
        }
        guard place < scalars.count, isDigit(scalars[place]) else { throw failure("no digits", at: place) }
        if scalars[place] == "0" {
            place += 1
        } else {
            skipDigits(in: scalars, at: &place)
        }
        if place < scalars.count, scalars[place] == "." {
            place += 1
            guard place < scalars.count, isDigit(scalars[place]) else { throw failure("no fraction", at: place) }
            skipDigits(in: scalars, at: &place)
        }
        if place < scalars.count, scalars[place] == "e" || scalars[place] == "E" {
            place += 1
            if place < scalars.count, scalars[place] == "+" || scalars[place] == "-" {
                place += 1
            }
            guard place < scalars.count, isDigit(scalars[place]) else { throw failure("no exponent", at: place) }
            skipDigits(in: scalars, at: &place)
        }
        guard let number = Double(String(String.UnicodeScalarView(scalars[start..<place]))), number.isFinite else {
            throw failure("a number no Double holds", at: start)
        }

        return number
    }

    private func literal(_ word: String, in scalars: [Unicode.Scalar], at place: inout Int) throws {
        let end = place + word.unicodeScalars.count
        guard end <= scalars.count, scalars[place..<end].elementsEqual(word.unicodeScalars) else {
            throw failure("no value", at: place)
        }
        place = end
    }

    private func skipDigits(in scalars: [Unicode.Scalar], at place: inout Int) {
        while place < scalars.count, isDigit(scalars[place]) {
            place += 1
        }
    }

    // Space, tab, line feed and carriage return.
    private func skipSpace(in scalars: [Unicode.Scalar], at place: inout Int) {
        while place < scalars.count, [" ", "\t", "\n", "\r"].contains(scalars[place]) {
            place += 1
        }
    }

    private func isDigit(_ scalar: Unicode.Scalar) -> Bool {
        ("0"..."9").contains(scalar)
    }

    private func failure(_ problem: String, at place: Int) -> DecodingError {
        DecodingError.dataCorrupted(
            DecodingError.Context(codingPath: [], debugDescription: "not JSON: \(problem) at scalar \(place)")
        )
    }
}
