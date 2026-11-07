//
//  JSONKeyedEncodingContainer.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// Encodes the members of an object into its JSONNode, each under the name its key's text is.
struct JSONKeyedEncodingContainer<Key: CodingKey>: KeyedEncodingContainerProtocol {
    // MARK: - Property
    let codingPath: [any CodingKey]

    private let node: JSONNode

    // MARK: - Initializer
    init(node: JSONNode, codingPath: [any CodingKey]) {
        self.node = node
        self.codingPath = codingPath
    }

    // MARK: - Public
    mutating func encodeNil(forKey key: Key) throws {
        try encoder(forKey: key).encodeNil()
    }

    mutating func encode<Value: Encodable>(_ value: Value, forKey key: Key) throws {
        try value.encode(to: encoder(forKey: key))
    }

    mutating func nestedContainer<NestedKey: CodingKey>(
        keyedBy keyType: NestedKey.Type,
        forKey key: Key
    ) -> KeyedEncodingContainer<NestedKey> {
        encoder(forKey: key).container(keyedBy: keyType)
    }

    mutating func nestedUnkeyedContainer(forKey key: Key) -> any UnkeyedEncodingContainer {
        encoder(forKey: key).unkeyedContainer()
    }

    mutating func superEncoder() -> any Encoder {
        encoder(forName: "super")
    }

    mutating func superEncoder(forKey key: Key) -> any Encoder {
        encoder(forKey: key)
    }

    // MARK: - Private
    private func encoder(forKey key: Key) -> JSONNodeEncoder {
        JSONNodeEncoder(node: node.member(JSONName(key.stringValue)), codingPath: codingPath + [key])
    }

    private func encoder(forName name: JSONName) -> JSONNodeEncoder {
        JSONNodeEncoder(node: node.member(name), codingPath: codingPath + [name])
    }
}
