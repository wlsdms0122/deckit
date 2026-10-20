//
//  Deck.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The kernel: what a mod is and what it keeps.
public final class Deck {
    // MARK: - Property
    private let record: Record
    private let state: State
    private let setting: Setting
    private let dataFolder: DataFolder
    private let catalog: Catalog

    // MARK: - Initializer
    // `home` is deckit's folder, `ship` the folders of the mods the app ships, and `sources` folders of mods read in
    // place. A manifest is read against `api`, the mod contract the mods are run with, and with what the layers on deck
    // add to it: the `permissions` they guard what they add with, deck's own among them, and their `fields`.
    public init(
        home: URL,
        ship: [URL],
        sources: [URL],
        api: Version,
        permissions: [Permission],
        fields: [any ManifestField]
    ) throws {
        let store = Store()
        let folder = home.appending(path: "mods", directoryHint: .isDirectory)
        let reader = try ManifestReader(api: api, permissions: permissions, fields: fields, store: store)
        let modFolder = ModFolder(reader: reader, store: store)
        let state = State(root: home.appending(path: "state", directoryHint: .isDirectory), store: store)
        self.record = Record(folder: home.appending(path: "records", directoryHint: .isDirectory), store: store)
        self.state = state
        self.setting = Setting(folder: home.appending(path: "settings", directoryHint: .isDirectory), store: store)
        self.dataFolder = DataFolder(folder: home.appending(path: "data", directoryHint: .isDirectory), store: store)
        self.catalog = Catalog(
            folder: folder,
            sources: sources,
            ship: ship,
            modFolder: modFolder,
            installer: Installer(home: home, folder: folder, ship: ship, modFolder: modFolder, store: store),
            state: state,
            store: store
        )
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

        case "catalog/read":
            return catalog.mods()

        case "catalog/arrange":
            let params = try call.params.decode(as: ArrangeCatalogParams.self)
            try catalog.arrange(params.ids)
            return true

        case "catalog/install-shipped":
            return try catalog.installShipped()

        case "catalog/would-install":
            let params = try call.params.decode(as: InstallModParams.self)
            return try catalog.wouldInstall(from: URL(filePath: params.from))

        case "catalog/install":
            let params = try call.params.decode(as: InstallModParams.self)
            return try catalog.install(from: URL(filePath: params.from))

        case "catalog/remove":
            let params = try call.params.decode(as: RemoveModParams.self)
            return try catalog.remove(params.id)

        case "data/count":
            let params = try call.params.decode(as: CountDataParams.self)
            return try dataFolder.count(mod: params.mod)

        case "data/erase":
            let params = try call.params.decode(as: EraseDataParams.self)
            try dataFolder.erase(mod: params.mod)
            return true

        default:
            return nil
        }
    }

    // MARK: - Private
}
