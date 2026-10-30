//
//  Node.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation
import CNodeAPI

// JavaScript's values as the module reads and makes them, through Node-API, in the environment that loaded it.
@MainActor
struct Node {
    // MARK: - Property
    let environment: napi_env

    // MARK: - Initializer
    init(_ environment: napi_env) {
        self.environment = environment
    }

    // MARK: - Public
    // What a call was handed, `count` of them, undefined past what it was given.
    func arguments(
        _ info: napi_callback_info,
        count: Int
    ) throws -> (values: [napi_value], data: UnsafeMutableRawPointer?) {
        var count = count
        var values = [napi_value?](repeating: nil, count: count)
        var data: UnsafeMutableRawPointer?
        try check(napi_get_cb_info(environment, info, &count, &values, nil, &data))

        return (values.compactMap { $0 }, data)
    }

    func string(_ value: napi_value) throws -> String {
        var length = 0
        try check(napi_get_value_string_utf8(environment, value, nil, 0, &length))
        var buffer = [CChar](repeating: 0, count: length + 1)
        try check(napi_get_value_string_utf8(environment, value, &buffer, length + 1, &length))

        return String(decoding: buffer.prefix(length).map { UInt8(bitPattern: $0) }, as: UTF8.self)
    }

    func number(_ value: napi_value) throws -> Double {
        var number = 0.0
        try check(napi_get_value_double(environment, value, &number))

        return number
    }

    func bool(_ value: napi_value) throws -> Bool {
        var bool = false
        try check(napi_get_value_bool(environment, value, &bool))

        return bool
    }

    // A value's own member, or nil where it is undefined or null.
    func member(_ object: napi_value, _ name: String) throws -> napi_value? {
        var value: napi_value?
        try check(napi_get_named_property(environment, object, name, &value))
        guard let value, !isNothing(value) else { return nil }

        return value
    }

    func isNothing(_ value: napi_value) -> Bool {
        var type = napi_undefined
        napi_typeof(environment, value, &type)

        return type == napi_undefined || type == napi_null
    }

    func array(_ value: napi_value) throws -> [napi_value] {
        var length: UInt32 = 0
        try check(napi_get_array_length(environment, value, &length))

        return try (0..<length).map { index in
            var element: napi_value?
            try check(napi_get_element(environment, value, index, &element))
            guard let element else { throw NodeError(message: "an array has a hole at \(index)") }

            return element
        }
    }

    // `{ x, y, width, height }`.
    func rect(_ value: napi_value) throws -> CGRect {
        func part(_ name: String) throws -> Double {
            guard let member = try member(value, name) else { throw NodeError(message: "a rect has no \(name)") }

            return try number(member)
        }

        return CGRect(x: try part("x"), y: try part("y"), width: try part("width"), height: try part("height"))
    }

    // The address a Buffer holds, as Electron hands a native handle.
    func pointer(_ value: napi_value) throws -> UnsafeMutableRawPointer {
        var data: UnsafeMutableRawPointer?
        var length = 0
        try check(napi_get_buffer_info(environment, value, &data, &length))
        guard let data, length >= MemoryLayout<UInt>.size,
            let pointer = UnsafeMutableRawPointer(bitPattern: data.load(as: UInt.self))
        else {
            throw NodeError(message: "a handle holds no address")
        }

        return pointer
    }

    // Swift's String, Bool, Int, Double, nil, arrays and string-keyed dictionaries of them, and a `Reply`.
    func make(_ value: Any?) throws -> napi_value {
        var made: napi_value?
        switch value {
        case nil:
            try check(napi_get_null(environment, &made))

        case let value as String:
            try check(napi_create_string_utf8(environment, value, value.utf8.count, &made))

        case let value as Bool:
            try check(napi_get_boolean(environment, value, &made))

        case let value as Int:
            try check(napi_create_double(environment, Double(value), &made))

        case let value as Double:
            try check(napi_create_double(environment, value, &made))

        case let value as [Any?]:
            try check(napi_create_array_with_length(environment, value.count, &made))
            for (index, element) in value.enumerated() {
                try check(napi_set_element(environment, made, UInt32(index), try make(element)))
            }

        case let value as [String: Any?]:
            try check(napi_create_object(environment, &made))
            for (name, member) in value {
                try check(napi_set_named_property(environment, made, name, try make(member)))
            }

        case let value as Reply:
            made = try value.function(in: self)

        default:
            throw NodeError(message: "\(type(of: value)) has no JavaScript value")
        }
        guard let made else { throw NodeError(message: "no value was made") }

        return made
    }

    func undefined() -> napi_value? {
        var value: napi_value?
        napi_get_undefined(environment, &value)

        return value
    }

    func throwError(_ error: Error) {
        let message = (error as? NodeError)?.message ?? String(describing: error)
        napi_throw_error(environment, nil, message)
    }

    func check(_ status: napi_status) throws {
        guard status != napi_ok else { return }
        var info: UnsafePointer<napi_extended_error_info>?
        napi_get_last_error_info(environment, &info)
        let message = info?.pointee.error_message.map { String(cString: $0) } ?? "status \(status.rawValue)"
        throw NodeError(message: message)
    }

    // MARK: - Private
}
