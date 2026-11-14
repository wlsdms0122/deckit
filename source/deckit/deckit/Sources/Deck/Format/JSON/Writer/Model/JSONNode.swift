//
//  JSONNode.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// A value encoded so far, which each container that encodes into it fills.
final class JSONNode {
    // MARK: - Property
    private(set) var content: JSONContent = .empty

    // How many items it holds as an array, or 0.
    var count: Int {
        guard case let .array(nodes) = content else { return 0 }
        return nodes.count
    }

    // MARK: - Initializer
    // MARK: - Public
    func hold(_ content: JSONContent) {
        self.content = content
    }

    // An object from now on, keeping the members it has.
    func holdObject() {
        if case .object = content { return }
        content = .object([:])
    }

    // An array from now on, keeping the items it has.
    func holdArray() {
        if case .array = content { return }
        content = .array([])
    }

    // The new node of the member `name`, in place of the one it had, the node an object from now on.
    func member(_ name: JSONName) -> JSONNode {
        var nodes: [JSONName: JSONNode] = if case let .object(nodes) = content { nodes } else { [:] }
        content = .empty
        let node = JSONNode()
        nodes[name] = node
        content = .object(nodes)
        return node
    }

    // The new node of an item after the last, the node an array from now on.
    func item() -> JSONNode {
        var nodes: [JSONNode] = if case let .array(nodes) = content { nodes } else { [] }
        content = .empty
        let node = JSONNode()
        nodes.append(node)
        content = .array(nodes)
        return node
    }

    // MARK: - Private
}
