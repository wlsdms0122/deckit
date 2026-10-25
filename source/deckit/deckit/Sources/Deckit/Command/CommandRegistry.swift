//
//  CommandRegistry.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The commands there are: those each running mod's run contributed under `commands`, declared in start(), and those
// a host declares under a name of its own. A command is found by its owner and its name, never by a joined id.
public final class CommandRegistry {
    // MARK: - Property
    private let contributionKey = "commands"
    private let deck: Deck
    private let hostName: String
    // In the order they were declared.
    private var hostCommands: [RegisteredCommand] = []

    // MARK: - Initializer
    // `hostName` is the app's, as a person reads it.
    init(deck: Deck, hostName: String) {
        self.deck = deck
        self.hostName = hostName
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
    // Commands of a host, `owner` its name, which starts with "@". Each name is declared once.
    public func define(_ declarations: [JSONValue], owner: String) throws {
        guard owner.hasPrefix("@"), Command.isName(String(owner.dropFirst())) else { throw CommandError.notAName(owner) }
        let host = CommandOwner.host(id: owner, name: hostName)
        var next = hostCommands
        for value in declarations {
            let command = try Command(declared: value)
            guard !next.contains(where: { registered in registered.owner == host && registered.command.name == command.name })
            else {
                throw CommandError.defined(host.id(of: command.name))
            }
            next.append(RegisteredCommand(owner: host, command: command))
        }
        hostCommands = next
    }

    // The hosts' first, in the order declared, then each running mod's, in the load order.
    public func list() -> [RegisteredCommand] {
        let mods = deck.catalog.loading.flatMap { mod in
            let owner = CommandOwner.mod(id: mod.manifest.id, name: mod.manifest.name)
            return declared(in: deck.contributions(of: mod.manifest.id)).map { command in
                RegisteredCommand(owner: owner, command: command)
            }
        }

        return hostCommands + mods
    }

    // `owner`'s command `name`, refused when there is none: what completes one of its args asks this first.
    public func find(_ name: String, of owner: String) throws -> RegisteredCommand {
        guard Command.isName(name) else { throw CommandError.notAName(name) }
        guard let registered = list().first(where: { registered in
            registered.owner.id == owner && registered.command.name == name
        }) else {
            throw CommandError.noSuchCommand("\(owner).\(name)")
        }

        return registered
    }

    // `owner`'s command `name`, which `args` fit, refused with why: what runs it asks this first.
    public func check(_ name: String, of owner: String, args: JSONValue?) throws -> RegisteredCommand {
        let registered = try find(name, of: owner)
        if let why = registered.command.problem(ofArguments: args) {
            throw CommandError.arguments(command: registered.owner.id(of: name), why: why)
        }

        return registered
    }

    // The commands a run contributed that can be used.
    func declared(in contributions: Contribution?) -> [Command] {
        written(in: contributions).compactMap { value in try? Command(declared: value) }
    }

    // MARK: - Private
    private func written(in contributions: Contribution?) -> [JSONValue] {
        guard case let .array(values) = contributions?.layers[contributionKey] else { return [] }
        return values
    }
}
