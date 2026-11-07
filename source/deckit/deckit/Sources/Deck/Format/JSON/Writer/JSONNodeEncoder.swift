//
//  JSONNodeEncoder.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// Encodes a value into a JSONNode, and is the container of a single value encoded there. A number is written as
// Foundation's JSONEncoder writes it: an integer as its digits, a floating-point number without a trailing ".0".
final class JSONNodeEncoder: Encoder, SingleValueEncodingContainer {
    // MARK: - Property
    let codingPath: [any CodingKey]
    let userInfo: [CodingUserInfoKey: Any] = [:]

    private let node: JSONNode

    // MARK: - Initializer
    init(node: JSONNode, codingPath: [any CodingKey]) {
        self.node = node
        self.codingPath = codingPath
    }

    // MARK: - Public
    func container<Key: CodingKey>(keyedBy type: Key.Type) -> KeyedEncodingContainer<Key> {
        node.holdObject()
        return KeyedEncodingContainer(JSONKeyedEncodingContainer<Key>(node: node, codingPath: codingPath))
    }

    func unkeyedContainer() -> any UnkeyedEncodingContainer {
        node.holdArray()
        return JSONUnkeyedEncodingContainer(node: node, codingPath: codingPath)
    }

    func singleValueContainer() -> any SingleValueEncodingContainer {
        self
    }

    func encodeNil() throws {
        node.hold(.null)
    }

    func encode(_ value: Bool) throws {
        node.hold(.bool(value))
    }

    func encode(_ value: String) throws {
        node.hold(.string(value))
    }

    func encode(_ value: Double) throws {
        node.hold(.number(try written(value)))
    }

    func encode(_ value: Float) throws {
        node.hold(.number(try written(value)))
    }

    func encode(_ value: Int) throws {
        node.hold(.number(String(value)))
    }

    func encode(_ value: Int8) throws {
        node.hold(.number(String(value)))
    }

    func encode(_ value: Int16) throws {
        node.hold(.number(String(value)))
    }

    func encode(_ value: Int32) throws {
        node.hold(.number(String(value)))
    }

    func encode(_ value: Int64) throws {
        node.hold(.number(String(value)))
    }

    func encode(_ value: UInt) throws {
        node.hold(.number(String(value)))
    }

    func encode(_ value: UInt8) throws {
        node.hold(.number(String(value)))
    }

    func encode(_ value: UInt16) throws {
        node.hold(.number(String(value)))
    }

    func encode(_ value: UInt32) throws {
        node.hold(.number(String(value)))
    }

    func encode(_ value: UInt64) throws {
        node.hold(.number(String(value)))
    }

    func encode<Value: Encodable>(_ value: Value) throws {
        try value.encode(to: self)
    }

    // MARK: - Private
    // JSON writes no infinity and no NaN.
    private func written<Number: BinaryFloatingPoint & LosslessStringConvertible>(_ value: Number) throws -> String {
        guard value.isFinite else {
            let context = EncodingError.Context(
                codingPath: codingPath,
                debugDescription: "\(value) is not a JSON number"
            )
            throw EncodingError.invalidValue(value, context)
        }

        let text = value.description
        return text.hasSuffix(".0") ? String(text.dropLast(2)) : text
    }
}
