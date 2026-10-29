//
//  CommandRegistry.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The commands there are: those each running mod's run contributes under `commands`, and those a host declares under
// a name of its own. A command is found by its provider and its name, never by a joined id.
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
    // A declaration that cannot be used is told so as the mod starts, and left out.
    func problems(of run: Run, mod: Mod) -> [String] {
        written(in: run.contributions).compactMap { value in
            do {
                _ = try Command(declared: value)
                return nil
            } catch let refusal as CommandError {
                return refusal.message
            } catch {
                return "a command cannot be used: \(error)"
            }
        }
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

    // The hosts' first, in the order declared, then each running mod's, in the load order.
    public func list() -> [RegisteredCommand] {
        let mods = deck.catalog.loading.flatMap { mod in
            let provider = Provider.mod(id: mod.manifest.id, name: mod.manifest.name)
            return declared(in: deck.contributions(of: mod.manifest.id)).map { command in
                RegisteredCommand(provider: provider, command: command)
            }
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

    // The commands a run contributed that can be used.
    private func declared(in contributions: Contribution?) -> [Command] {
        written(in: contributions).compactMap { value in try? Command(declared: value) }
    }

    // MARK: - Private
    private func written(in contributions: Contribution?) -> [JSONValue] {
        guard case let .array(values) = contributions?.layers[contributionKey] else { return [] }
        return values
    }
}
