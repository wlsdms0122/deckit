//
//  Reply.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation
import CNodeAPI

// A JavaScript function that hands what it is called with to `answer`: how JavaScript answers a question WebKit asks
// and waits on, as a page's permission.
@MainActor
final class Reply {
    // MARK: - Property
    private let answer: @MainActor (Node, [napi_value]) throws -> Void

    // MARK: - Initializer
    init(_ answer: @escaping @MainActor (Node, [napi_value]) throws -> Void) {
        self.answer = answer
    }

    // MARK: - Public
    // The function holds the reply until JavaScript lets the function go.
    func function(in node: Node) throws -> napi_value {
        let data = Unmanaged.passRetained(self).toOpaque()
        var function: napi_value?
        try node.check(napi_create_function(node.environment, "reply", 5, replied, data, &function))
        guard let function else { throw NodeError(message: "no reply was made") }
        try node.check(napi_add_finalizer(node.environment, function, data, released, nil, nil))

        return function
    }

    func called(_ node: Node, _ arguments: [napi_value]) throws {
        try answer(node, arguments)
    }

    // MARK: - Private
}

// Node calls a module's functions on the thread JavaScript runs on, the main one.
private func replied(_ environment: napi_env?, _ info: napi_callback_info?) -> napi_value? {
    guard let environment, let info else { return nil }
    nonisolated(unsafe) let given = (environment, info)
    MainActor.assumeIsolated {
        let (environment, info) = given
        let node = Node(environment)
        do {
            let (arguments, data) = try node.arguments(info, count: 1)
            guard let data else { return }
            try Unmanaged<Reply>.fromOpaque(data).takeUnretainedValue().called(node, arguments)
        } catch {
            node.throwError(error)
        }
    }

    return nil
}

private func released(_ environment: napi_env?, _ data: UnsafeMutableRawPointer?, _ hint: UnsafeMutableRawPointer?) {
    guard let data else { return }
    nonisolated(unsafe) let reply = data
    MainActor.assumeIsolated {
        Unmanaged<Reply>.fromOpaque(reply).release()
    }
}
