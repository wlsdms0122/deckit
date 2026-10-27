//
//  Configuration.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation
import Deck

// What can be configured of each mod: what its run declares as its entry is read, and the values saved, which deck keeps
// for the mod under this one's name. A value saved is read as far as its declaration takes it: one it does not take
// reads as the default, and is left as it is saved.
public final class Configuration {
    // MARK: - Property
    private let name = "configuration"
    private let deck: Deck
    // Mod id -> what its run declared, in the order declared.
    private var declarations: [String: [ConfigurationDeclaration]] = [:]

    // MARK: - Initializer
    init(deck: Deck) throws {
        self.deck = deck
        try deck.modState.reserve(name)
    }

    // MARK: - Public
    // A mod's configuration stands from its run's declaring it as it launches until a later run declares it again, and
    // while the mod loads: one whose start failed can still be configured. What an older run declared, or a run past
    // launching, is not kept. What deckit does not read is left out, and is a problem of the run, as is a value saved
    // that reads as the default.
    public func declare(_ declared: [JSONValue], mod: String, run number: Int) throws -> [Effect] {
        guard let run = deck.run(of: mod), run.number == number, run.state == .launching else { return [] }

        var kept: [ConfigurationDeclaration] = []
        var problems: [String] = []
        for item in declared {
            switch Result(catching: { try item.decode(as: ConfigurationDeclaration.self) }) {
            case let .success(declaration):
                kept.append(declaration)

            case let .failure(error):
                problems.append(problem(of: item, error))
            }
        }
        declarations[mod] = kept
        problems += unread(saved: read(mod: mod), declared: kept)

        var effects: [Effect] = []
        for problem in problems {
            effects += try deck.report(mod, run: number, problem: problem)
        }
        return effects
    }

    // What each configuration of the mod reads as: what was saved, when its declaration takes it, or the default.
    public func values(of mod: String) -> [String: ConfigurationValue] {
        values(of: mod, declared: declared(mod))
    }

    // Every loading mod's that declared any, in the load order.
    public func list() -> [ConfigurationGroup] {
        deck.catalog.loading
            .compactMap { mod in
                let id = mod.manifest.id
                let declared = declared(id)
                guard !declared.isEmpty else { return nil }

                let values = values(of: id, declared: declared)
                let items = declared.map { declaration in
                    ConfigurationItem(declaration: declaration, value: values[declaration.key])
                }

                return ConfigurationGroup(id: id, name: mod.manifest.name, items: items)
            }
    }

    public func set(mod: String, key: String, value: ConfigurationValue?) throws -> ConfigurationChange {
        guard let declaration = declared(mod).first(where: { declaration in declaration.key == key }) else {
            throw ConfigurationError.undeclared(mod: mod, key: key)
        }
        let next = try declaration.value(for: value)

        return ConfigurationChange(value: next, changed: try write(mod: mod, key: key, value: next))
    }

    // MARK: - Private
    // What a mod that loads, as the catalog was last read, declared.
    private func declared(_ mod: String) -> [ConfigurationDeclaration] {
        guard deck.catalog.loading.contains(where: { loading in loading.manifest.id == mod }) else { return [] }
        return declarations[mod] ?? []
    }

    // A value saved for what the mod does not declare is not handed back.
    private func values(of mod: String, declared: [ConfigurationDeclaration]) -> [String: ConfigurationValue] {
        let saved = read(mod: mod)
        var values: [String: ConfigurationValue] = [:]
        for declaration in declared {
            let value = saved[declaration.key].flatMap { value in declaration.takes(value) ? value : nil }
            values[declaration.key] = value ?? declaration.defaultValue
        }

        return values
    }

    // What is saved that is read as nothing, or as the default.
    private func unread(saved: [String: ConfigurationValue], declared: [ConfigurationDeclaration]) -> [String] {
        saved.keys.sorted().compactMap { key in
            guard let value = saved[key] else { return nil }
            guard let declaration = declared.first(where: { declaration in declaration.key == key }) else {
                return "configuration \"\(key)\" is saved, and the mod does not declare it"
            }
            guard !declaration.takes(value) else { return nil }

            return "configuration \"\(key)\" does not take \(value), which is saved: it reads as its default"
        }
    }

    // Named by its key, and by the field the decoding failed at.
    private func problem(of declared: JSONValue, _ error: any Error) -> String {
        guard case let .object(fields) = declared, case let .string(key)? = fields["key"] else {
            return "deckit does not read a configuration declared"
        }
        guard let place = (error as? DecodingError)?.place else {
            return "configuration \"\(key)\": deckit does not read it"
        }

        return "configuration \"\(key)\": deckit does not read its \(place)"
    }

    // A text that is not a table of values reads as none saved.
    private func read(mod: String) -> [String: ConfigurationValue] {
        guard let text = deck.modState.read(name, mod: mod) else { return [:] }
        return (try? JSONDecoder().decode([String: ConfigurationValue].self, from: Data(text.utf8))) ?? [:]
    }

    // One value saved among the others the mod has: whether it changed.
    private func write(mod: String, key: String, value: ConfigurationValue) throws -> Bool {
        var values = read(mod: mod)
        guard values[key] != value else { return false }

        values[key] = value
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        try deck.modState.write(name, mod: mod, text: String(decoding: try encoder.encode(values), as: UTF8.self))

        return true
    }
}
