//
//  DeckitWeb.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation
import CNodeAPI

// The web pages deckit shows on WebKit, as a module Node loads in Electron's main process, on the main thread, where
// AppKit runs too.
@MainActor private var engine: WebEngine?

@_cdecl("napi_register_module_v1")
public func registerModule(_ environment: napi_env?, _ exports: napi_value?) -> napi_value? {
    guard let environment, let exports else { return exports }
    nonisolated(unsafe) let given = (environment, exports)
    MainActor.assumeIsolated {
        let (environment, exports) = given
        let node = Node(environment)
        let made = engine ?? WebEngine(node: node)
        engine = made
        do {
            for export in Export.allCases {
                var function: napi_value?
                let data = UnsafeMutableRawPointer(bitPattern: export.rawValue + 1)
                try node.check(
                    napi_create_function(environment, "\(export)", "\(export)".utf8.count, called, data, &function)
                )
                try node.check(napi_set_named_property(environment, exports, "\(export)", function))
            }
        } catch {
            node.throwError(error)
        }
    }

    return exports
}

private func called(_ environment: napi_env?, _ info: napi_callback_info?) -> napi_value? {
    guard let environment, let info else { return nil }
    nonisolated(unsafe) let given = (environment, info)
    nonisolated(unsafe) var result: napi_value?
    MainActor.assumeIsolated {
        let (environment, info) = given
        let node = Node(environment)
        do {
            let (arguments, data) = try node.arguments(info, count: 3)
            guard let engine, let export = data.flatMap({ Export(rawValue: Int(bitPattern: $0) - 1) }) else {
                throw NodeError(message: "the module is not loaded")
            }
            result = try engine.call(export, arguments)
        } catch {
            node.throwError(error)
        }
    }

    return result
}
