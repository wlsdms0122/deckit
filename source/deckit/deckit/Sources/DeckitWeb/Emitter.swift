//
//  Emitter.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation
import CNodeAPI

// What a web page tells JavaScript, through the function JavaScript handed for it: `emit(event, payload)`, answered at
// once. A call from AppKit runs as Node runs a callback, so what it queues runs after it.
@MainActor
final class Emitter {
    // MARK: - Property
    private let node: Node
    private var function: napi_ref?
    private var context: napi_async_context?

    // MARK: - Initializer
    init(node: Node, function value: napi_value) throws {
        self.node = node
        var reference: napi_ref?
        try node.check(napi_create_reference(node.environment, value, 1, &reference))
        var name: napi_value?
        try node.check(napi_create_string_utf8(node.environment, "deckit-web", 10, &name))
        var context: napi_async_context?
        try node.check(napi_async_init(node.environment, nil, name, &context))
        self.function = reference
        self.context = context
    }

    // MARK: - Public
    // What the listener answers, as `read` reads it, or nil where it threw or answered what `read` does not read.
    @discardableResult
    func emit<Value>(
        _ event: String,
        _ payload: [String: Any?] = [:],
        read: (Node, napi_value) throws -> Value? = { _, _ in nil }
    ) -> Value? {
        guard let function, let context else { return nil }
        var scope: napi_handle_scope?
        napi_open_handle_scope(node.environment, &scope)
        defer { napi_close_handle_scope(node.environment, scope) }
        do {
            var callee: napi_value?
            try node.check(napi_get_reference_value(node.environment, function, &callee))
            let arguments: [napi_value?] = [try node.make(event), try node.make(payload)]
            var global: napi_value?
            try node.check(napi_get_global(node.environment, &global))
            var result: napi_value?
            let status = napi_make_callback(node.environment, context, global, callee, 2, arguments, &result)
            guard status == napi_ok, let result else {
                report(event)
                return nil
            }

            return try read(node, result)
        } catch {
            FileHandle.standardError.write(Data("[deckit-web] \(event): \(error)\n".utf8))
            return nil
        }
    }

    func emit(_ event: String, _ payload: [String: Any?] = [:]) {
        let _: Bool? = emit(event, payload) { _, _ in nil }
    }

    func release() {
        if let function { napi_delete_reference(node.environment, function) }
        if let context { napi_async_destroy(node.environment, context) }
        function = nil
        context = nil
    }

    // MARK: - Private
    // A throw in the listener is cleared here, so it does not stay pending on the next call, and told.
    private func report(_ event: String) {
        var exception: napi_value?
        guard napi_get_and_clear_last_exception(node.environment, &exception) == napi_ok, let exception else { return }
        var text: napi_value?
        napi_coerce_to_string(node.environment, exception, &text)
        let message = (text.flatMap { try? node.string($0) }) ?? "a throw"
        FileHandle.standardError.write(Data("[deckit-web] \(event): \(message)\n".utf8))
    }
}
