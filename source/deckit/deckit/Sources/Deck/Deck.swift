//
//  Deck.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The kernel: what a mod is and what it keeps. `home` is deckit's folder.
public final class Deck {
    // MARK: - Property
    private let record: Record

    // MARK: - Initializer
    public init(home: URL) {
        let store = Store()
        self.record = Record(folder: home.appending(path: "records", directoryHint: .isDirectory), store: store)
    }

    // MARK: - Public
    // What deck answers a call with, or nil for a method that is not deck's. A method that answers nothing else
    // answers true once it is done; one whose answer may be none answers it as an optional value, never as nil.
    public func answer(_ call: Call) throws -> (any Encodable & Sendable)? {
        switch call.method {
        case "record/read":
            let params = try call.params.decode(as: ReadRecordParams.self)
            return try record.read(mod: params.mod, key: params.key) as any Encodable & Sendable

        case "record/write":
            let params = try call.params.decode(as: WriteRecordParams.self)
            try record.write(mod: params.mod, key: params.key, text: params.text)
            return true

        case "record/remove":
            let params = try call.params.decode(as: RemoveRecordParams.self)
            try record.remove(mod: params.mod, key: params.key)
            return true

        case "record/keys":
            let params = try call.params.decode(as: RecordKeysParams.self)
            return try record.keys(mod: params.mod)

        case "record/erase":
            let params = try call.params.decode(as: EraseRecordsParams.self)
            try record.erase(mod: params.mod)
            return true

        case "record/count":
            let params = try call.params.decode(as: CountRecordsParams.self)
            return try record.count(mod: params.mod)

        default:
            return nil
        }
    }

    // MARK: - Private
}
