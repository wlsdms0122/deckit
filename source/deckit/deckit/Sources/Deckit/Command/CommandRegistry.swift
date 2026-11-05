//
//  CommandRegistry.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The commands there are: those each mod declares under `commands` in its contributes, running or not, those its run
// registers beside them while it runs, and those a host declares under a name of its own. A command is found by its
// provider and its name, never by a joined id.
public final class CommandRegistry {
    // MARK: - Property
    private let contributionKey = "commands"
    private let deck: Deck
    // In the order they were declared.
    private var hostCommands: [RegisteredCommand] = []

    // MARK: - Initializer
    init(deck: Deck) {
        self.deck = deck
    }

    // MARK: - Lifecycle
    // A declaration that cannot be used, the mod's or its run's, is told so as the mod starts, and left out.
    func problems(of run: Run, mod: Mod) -> [String] {
        let contributed: [(String, JSONValue)]
        switch mod.contributes[contributionKey] {
        case .none:
            contributed = []

        case let .object(entries):
            contributed = entries.sorted { one, other in one.key < other.key }

        case .some:
            return ["contributes \"\(contributionKey)\" must be an object of commands by name"]
        }
        let names = Set(contributed.map { name, _ in name })
        let registered = written(in: run.contributions).filter { value in !names.contains(name(of: value)) }

        return contributed.compactMap { name, value in problem { try Command(name: name, declared: value) } }
            + registered.compactMap { value in problem { try Command(declared: value) } }
    }

    // MARK: - Public
    // Commands of a host, `provider` its name, which starts with "@", and `name` the host's as a person reads it. Each
    // name is declared once.
    public func define(_ declarations: [JSONValue], provider: String, name: String) throws {
        guard let host = Provider(host: provider, name: name) else { throw CommandError.notAName(provider) }
        var next = hostCommands
        for value in declarations {
            let command = try Command(declared: value)
            guard !next.contains(where: { registered in
                registered.provider == host && registered.command.name == command.name
            }) else {
                throw CommandError.defined(host.id(of: command.name))
            }
            next.append(RegisteredCommand(provider: host, command: command))
        }
        hostCommands = next
    }

    // The hosts' first, in the order declared, then each mod's, in the mods' order: those it declares, by name, running
    // or not, then those its run registers beside them.
    public func list() -> [RegisteredCommand] {
        let mods = deck.catalog.loading.flatMap { mod in
            let provider = Provider.mod(id: mod.manifest.id, name: mod.manifest.name)
            let declared = declared(of: mod)
            let names = Set(declared.map(\.name))
            let registered = registered(in: deck.contributions(of: mod.manifest.id)).filter { command in
                !names.contains(command.name)
            }
            return (declared + registered).map { command in RegisteredCommand(provider: provider, command: command) }
        }

        return hostCommands + mods
    }

    // The hosts that declared commands.
    var hosts: [Provider] {
        hostCommands.map(\.provider)
    }

    // `provider`'s command `name`, refused when there is none: what completes one of its args asks this first.
    public func find(_ name: String, of provider: String) throws -> RegisteredCommand {
        guard Provider.isName(name) else { throw CommandError.notAName(name) }
        guard let registered = list().first(where: { registered in
            registered.provider.id == provider && registered.command.name == name
        }) else {
            throw CommandError.noSuchCommand("\(provider).\(name)")
        }

        return registered
    }

    // `provider`'s command `name`, which `args` fit, refused with why: what runs it asks this first.
    public func check(_ name: String, of provider: String, args: JSONValue?) throws -> RegisteredCommand {
        let registered = try find(name, of: provider)
        if let why = registered.command.problem(ofArguments: args) {
            throw CommandError.arguments(command: registered.provider.id(of: name), why: why)
        }

        return registered
    }

    // MARK: - Private
    // The commands the mod declares that can be used, by name.
    private func declared(of mod: Mod) -> [Command] {
        guard case let .object(entries) = mod.contributes[contributionKey] else { return [] }
        return entries.sorted { one, other in one.key < other.key }.compactMap { name, value in
            try? Command(name: name, declared: value)
        }
    }

    // The commands a run registered that can be used.
    private func registered(in contributions: Contribution?) -> [Command] {
        written(in: contributions).compactMap { value in try? Command(declared: value) }
    }

    private func written(in contributions: Contribution?) -> [JSONValue] {
        guard case let .array(values) = contributions?.layers[contributionKey] else { return [] }
        return values
    }

    private func name(of value: JSONValue) -> String {
        guard case let .object(fields) = value, case let .string(name) = fields["name"] else { return "" }
        return name
    }

    private func problem(_ read: () throws -> Command) -> String? {
        do {
            _ = try read()
            return nil
        } catch let refusal as CommandError {
            return refusal.message
        } catch {
            return "a command cannot be used: \(error)"
        }
    }
}
