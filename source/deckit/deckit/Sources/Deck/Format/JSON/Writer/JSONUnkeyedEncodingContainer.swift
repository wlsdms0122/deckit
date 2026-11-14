//
//  JSONUnkeyedEncodingContainer.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// Encodes the items of an array into its JSONNode, each after the last.
struct JSONUnkeyedEncodingContainer: UnkeyedEncodingContainer {
    // MARK: - Property
    let codingPath: [any CodingKey]

    var count: Int {
        node.count
    }

    private let node: JSONNode

    // MARK: - Initializer
    init(node: JSONNode, codingPath: [any CodingKey]) {
        self.node = node
        self.codingPath = codingPath
    }

    // MARK: - Public
    mutating func encodeNil() throws {
        try nextEncoder().encodeNil()
    }

    mutating func encode<Value: Encodable>(_ value: Value) throws {
        try value.encode(to: nextEncoder())
    }

    mutating func nestedContainer<NestedKey: CodingKey>(
        keyedBy keyType: NestedKey.Type
    ) -> KeyedEncodingContainer<NestedKey> {
        nextEncoder().container(keyedBy: keyType)
    }

    mutating func nestedUnkeyedContainer() -> any UnkeyedEncodingContainer {
        nextEncoder().unkeyedContainer()
    }

    mutating func superEncoder() -> any Encoder {
        nextEncoder()
    }

    // MARK: - Private
    private func nextEncoder() -> JSONNodeEncoder {
        let index = JSONIndex(count)
        return JSONNodeEncoder(node: node.item(), codingPath: codingPath + [index])
    }
}
