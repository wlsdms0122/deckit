//
//  Deck.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The kernel: what a mod is and what it keeps. `home` is deck's folder.
public final class Deck {
    // MARK: - Property
    private let record: Record

    // MARK: - Initializer
    public init(home: URL) {
        self.record = Record(folder: home.appending(path: "records", directoryHint: .isDirectory))
    }

    // MARK: - Public
    // What deck answers of a call, or nil for a method that is not deck's.
    public func answer(_ call: Call) throws -> JSONValue? {
        switch call.method {
        case "record/read":
            let params = try call.params.decode(as: RecordParams.self)
            return try record.read(mod: params.mod, key: params.key).map(JSONValue.string) ?? .null

        case "record/write":
            let params = try call.params.decode(as: RecordWriteParams.self)
            try record.write(mod: params.mod, key: params.key, text: params.value)
            return .null

        case "record/remove":
            let params = try call.params.decode(as: RecordParams.self)
            try record.remove(mod: params.mod, key: params.key)
            return .null

        case "record/keys":
            let params = try call.params.decode(as: ModParams.self)
            return .array(try record.keys(mod: params.mod).map(JSONValue.string))

        case "record/erase":
            let params = try call.params.decode(as: ModParams.self)
            try record.erase(mod: params.mod)
            return .null

        default:
            return nil
        }
    }

    // MARK: - Private
}
