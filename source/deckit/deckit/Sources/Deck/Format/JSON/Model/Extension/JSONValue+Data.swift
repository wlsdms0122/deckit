//
//  JSONValue+Data.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

extension JSONValue {
    // MARK: - Property
    // MARK: - Initializer
    // The value the JSON text `data` writes, with white space around it, each member of an object under its own name:
    // two names of one canonical form are two members. Data that is not one JSON value throws
    // `DecodingError.dataCorrupted`, and so does a value nested deeper than JSONSerialization reads.
    package init(data: Data) throws {
        let object: Any
        do {
            object = try JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed)
        } catch {
            let description = (error as NSError).userInfo[NSDebugDescriptionErrorKey] as? String
            throw Self.corrupted(description ?? error.localizedDescription, by: error)
        }

        try self.init(object: object)
    }

    // MARK: - Public
    // MARK: - Private
    // `object` as JSONSerialization reads it. An object is enumerated as the NSDictionary it is, which compares names
    // by their UTF-16 code units, so each name read stays its own, and a boolean is an NSNumber that is a CFBoolean.
    private init(object: Any) throws {
        switch object {
        case is NSNull:
            self = .null

        case let number as NSNumber where CFGetTypeID(number) == CFBooleanGetTypeID():
            self = .bool(number.boolValue)

        case let number as NSNumber:
            self = .number(number.doubleValue)

        case let text as String:
            self = .string(text)

        case let items as NSArray:
            self = .array(try items.map(JSONValue.init(object:)))

        case let members as NSDictionary:
            let pairs = try members.map { name, value in
                guard let name = name as? String else { throw Self.corrupted("\(name) is not a name", by: nil) }
                return (JSONName(name), try JSONValue(object: value))
            }
            self = .object(Dictionary(uniqueKeysWithValues: pairs))

        default:
            throw Self.corrupted("\(object) is not a JSON value", by: nil)
        }
    }

    private static func corrupted(_ description: String, by error: (any Error)?) -> DecodingError {
        .dataCorrupted(DecodingError.Context(codingPath: [], debugDescription: description, underlyingError: error))
    }
}
