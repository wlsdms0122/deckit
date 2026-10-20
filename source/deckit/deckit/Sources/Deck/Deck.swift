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
    private let state: State
    private let setting: Setting

    // MARK: - Initializer
    public init(home: URL) {
        let store = Store()
        self.record = Record(folder: home.appending(path: "records", directoryHint: .isDirectory), store: store)
        self.state = State(root: home.appending(path: "state", directoryHint: .isDirectory), store: store)
        self.setting = Setting(folder: home.appending(path: "settings", directoryHint: .isDirectory), store: store)
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

        case "state/all":
            return try state.all()

        case "state/write":
            let params = try call.params.decode(as: WriteStateParams.self)
            try state.write(folder: params.folder, key: params.key, text: params.text)
            return true

        case "setting/read":
            let params = try call.params.decode(as: ReadSettingsParams.self)
            return setting.read(mod: params.mod)

        case "setting/write":
            let params = try call.params.decode(as: WriteSettingParams.self)
            return try setting.write(mod: params.mod, key: params.key, value: params.value)

        case "setting/erase":
            let params = try call.params.decode(as: EraseSettingsParams.self)
            try setting.erase(mod: params.mod)
            return true

        default:
            return nil
        }
    }

    // MARK: - Private
}
