//
//  Setting.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What the person can choose about each mod: what its run declares, and the values saved, one file a mod, kept apart
// from the mod's own data folder. A value is saved as its declaration takes it.
public final class Setting {
    // MARK: - Property
    private let fileExtension = "json"
    private let folder: URL
    private let store: Store
    private let catalog: Catalog
    private let runner: Runner
    // Mod id -> what its run declared, in the order declared.
    private var declarations: [String: [SettingDeclaration]] = [:]

    // MARK: - Initializer
    init(folder: URL, store: Store, catalog: Catalog, runner: Runner) {
        self.folder = folder
        self.store = store
        self.catalog = catalog
        self.runner = runner
    }

    // MARK: - Public
    // A mod's settings stand from its run's declaring them as it launches until a later run declares them again, or
    // until the mod no longer loads: one whose start failed can still be set. Whether they were kept: what an older
    // run declared, or a run past launching, is not.
    public func declare(_ settings: [SettingDeclaration], mod: String, run number: Int) -> Bool {
        guard let run = runner.run(of: mod), run.number == number, run.state == .launching else { return false }
        declarations[mod] = settings

        return true
    }

    // What a mod that does not load, as the catalog was last read, declared.
    func forget() {
        let loading = Set(catalog.lastRead.filter { mod in mod.problem == nil }.map(\.manifest.id))
        declarations = declarations.filter { id, _ in loading.contains(id) }
    }

    // The choices of `mod`, or of every mod, whose options its page works out as they are read.
    public func computedChoices(mod: String?) -> [SettingKey] {
        declarations.keys
            .filter { id in mod == nil || id == mod }
            .sorted()
            .flatMap { id in
                declarations[id, default: []]
                    .filter { declaration in declaration.type == .choice && declaration.computed }
                    .map { declaration in SettingKey(mod: id, key: declaration.key) }
            }
    }

    // Every loading mod's that declared any, in the person's order, with `choices`, the options their pages worked out.
    // A choice a page gave none for offers none. A saved value no option offers now (one this machine lacks, or one an
    // update took away) is offered marked absent, and left as it is.
    public func list(choices: [ComputedChoice]) -> [SettingGroup] {
        catalog.lastRead
            .filter { mod in mod.problem == nil }
            .compactMap { mod in
                let id = mod.manifest.id
                guard let declared = declarations[id], !declared.isEmpty else { return nil }

                let values = values(of: id, declared: declared)
                let items = declared.map { declaration in
                    let value = values[declaration.key]
                    let choice = choices.first { choice in choice.mod == id && choice.key == declaration.key }
                    let options = declaration.options(workedOut: choice?.options)

                    return SettingItem(
                        declaration: declaration,
                        value: value,
                        options: offered(options, value: value, for: declaration)
                    )
                }

                return SettingGroup(id: id, name: mod.manifest.name, items: items)
            }
    }

    // `options` are those the mod's page worked out, for a choice whose options are computed.
    public func set(mod: String, key: String, value: SettingValue?, options: [SettingOption]?) throws -> SettingChange {
        let declaration = try declaration(mod: mod, key: key)
        let next = try declaration.value(for: value, among: declaration.options(workedOut: options))

        return SettingChange(value: next, changed: try write(mod: mod, key: key, value: next))
    }

    // The action the mod declared under `key`, which its page runs: refused for a setting that is no action.
    public func action(mod: String, key: String) throws -> SettingDeclaration {
        let declaration = try declaration(mod: mod, key: key)
        guard declaration.type == .action else { throw SettingError.notAnAction(mod: mod, key: key) }

        return declaration
    }

    // A file that is not there, or that is not a table of values, reads as none saved.
    public func read(mod: String) -> [String: SettingValue] {
        guard let text = store.read(file(of: mod)) else { return [:] }
        return (try? JSONDecoder().decode([String: SettingValue].self, from: Data(text.utf8))) ?? [:]
    }

    func isKept(mod: String) -> Bool {
        store.exists(file(of: mod))
    }

    func erase(mod: String) throws {
        try store.remove(file(of: mod))
    }

    // MARK: - Private
    private func declaration(mod: String, key: String) throws(SettingError) -> SettingDeclaration {
        guard let declaration = declarations[mod]?.first(where: { declaration in declaration.key == key }) else {
            throw .undeclared(mod: mod, key: key)
        }

        return declaration
    }

    // What was saved, over what was declared by default. A value saved for a setting the mod no longer declares is not
    // handed back, and an action has none.
    private func values(of mod: String, declared: [SettingDeclaration]) -> [String: SettingValue] {
        let saved = read(mod: mod)
        var values: [String: SettingValue] = [:]
        for declaration in declared where declaration.type != .action {
            values[declaration.key] = saved[declaration.key] ?? declaration.defaultValue
        }

        return values
    }

    private func offered(
        _ options: [SettingOption],
        value: SettingValue?,
        for declaration: SettingDeclaration
    ) -> [SettingOption] {
        guard declaration.type == .choice else { return [] }
        guard let value, !options.contains(where: { option in option.value == value }) else { return options }

        return options + [SettingOption(value: value, label: String(describing: value), absent: true)]
    }

    // One value saved among the others the mod has: whether it changed.
    private func write(mod: String, key: String, value: SettingValue) throws -> Bool {
        var values = read(mod: mod)
        guard values[key] != value else { return false }

        values[key] = value
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        try store.write(String(decoding: try encoder.encode(values), as: UTF8.self), to: file(of: mod))

        return true
    }

    // Mod ids are held to their rule before a mod loads, so an id here is a file name.
    private func file(of mod: String) -> URL {
        folder.appending(path: mod).appendingPathExtension(fileExtension)
    }
}
