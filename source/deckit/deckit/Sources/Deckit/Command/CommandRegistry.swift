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
// provider and its name, never by a joined id. A mod's command is also run by a token of it the mod asked for, which
// lasts until its sender cancels it, a holder releases it, or its sender is not found. One deckit handed an interface's
// owner for an entry declared to it is the owner's as the owner: it also ends once its holder no longer owns the
// interface, or the entry, its command and args, is no longer declared to it.
public final class CommandRegistry {
    // MARK: - Property
    private let contributionKey = "commands"
    private let tokensKey = "command-tokens"
    private let catalog: Catalog
    private let state: State
    private let runs: RunTable
    // In the order they were declared.
    private var hostCommands: [RegisteredCommand] = []
    // In the order they were minted.
    private var tokens: [CommandToken]

    // MARK: - Initializer
    init(catalog: Catalog, state: State, runs: RunTable) {
        self.catalog = catalog
        self.state = state
        self.runs = runs
        state.reserve(tokensKey)
        let saved = try? state.read(folder: nil, key: tokensKey)
        self.tokens = saved.flatMap { text in try? JSONDecoder().decode([CommandToken].self, from: Data(text.utf8)) }
            ?? []
    }

    // MARK: - Lifecycle
    // A declaration that cannot be used is told so as the mod is read, and left out.
    func problems(of mod: Mod) -> [String] {
        let contributed: [(String, JSONValue)]
        switch mod.contributes[contributionKey] {
        case .none:
            contributed = []

        case let .object(entries):
            contributed = entries.sorted { one, other in one.key < other.key }

        case .some:
            return ["contributes \"\(contributionKey)\" must be an object of commands by name"]
        }

        return contributed.compactMap { name, value in problem { try Command(name: name, declared: value) } }
            + mod.declared.entries.sorted { one, other in one.key < other.key }.flatMap { interface, entries in
                entries.compactMap { entry in problem(ofEntry: entry, to: interface, mod: mod) }
            }
    }

    // A command its run registers beside those the mod declares that cannot be used is told so as the mod starts,
    // and left out.
    func problems(of contributions: [String: JSONValue], mod: Mod) -> [String] {
        let names: Set<String> = if case let .object(entries) = mod.contributes[contributionKey] {
            Set(entries.keys)
        } else {
            []
        }

        return written(in: contributions)
            .filter { value in !names.contains(name(of: value)) }
            .compactMap { value in problem { try Command(declared: value) } }
    }

    // The mods read again: a token ends once its sender is not found, and one deckit handed an owner once the role it
    // was handed for is gone.
    func read(_ mods: [Mod]) {
        let found = Set(mods.map(\.manifest.id))
        let kept = tokens.filter { token in
            found.contains(token.sender) && (token.holder == nil || isOwned(token))
        }
        guard kept != tokens else { return }

        try? save(kept)
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
        let mods = catalog.loading.flatMap { mod in
            let provider = Provider.mod(id: mod.manifest.id, name: mod.manifest.name)
            let declared = declared(of: mod)
            let names = Set(declared.map(\.name))
            let registered = registered(in: runs.contributions(of: mod.manifest.id)).filter { command in
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

    // A token of `sender`'s command `name`, which `args` fit now, that the sender hands over.
    public func mint(_ name: String, of sender: String, args: JSONValue?) throws -> CommandToken {
        _ = try check(name, of: sender, args: args)
        let token = CommandToken(
            id: UUID().uuidString,
            sender: sender,
            command: name,
            args: args,
            holder: nil,
            interface: nil
        )
        try save(tokens + [token])

        return token
    }

    // A token of the command `name` that `sender` declares, which `args` fit, that deckit hands `holder`, the owner of
    // `interface`, itself for an entry `sender` declares to it: one handed `holder` before for the same interface,
    // command and args is handed again.
    func hand(
        _ name: String,
        of sender: String,
        args: JSONValue?,
        to holder: String,
        for interface: String
    ) throws -> CommandToken {
        guard let mod = catalog.loading.first(where: { mod in mod.manifest.id == sender }) else {
            throw CommandError.noSuchCommand("\(sender).\(name)")
        }
        _ = try checkDeclared(name, of: mod, args: args)
        if let handed = tokens.first(where: { token in
            token.holder == holder && token.interface == interface && token.sender == sender && token.command == name
                && token.args == args
        }) {
            return handed
        }

        let token = CommandToken(
            id: UUID().uuidString,
            sender: sender,
            command: name,
            args: args,
            holder: holder,
            interface: interface
        )
        try save(tokens + [token])

        return token
    }

    // The token of `id`, its command there and its args fitting it, refused with why: what runs it asks this first.
    public func check(token id: String) throws -> CommandToken {
        guard let token = tokens.first(where: { token in token.id == id }) else { throw CommandError.noSuchToken }
        _ = try check(token.command, of: token.sender, args: token.args)

        return token
    }

    // The token of `id` ends, when `sender` is its sender.
    public func cancel(token id: String, of sender: String) throws {
        guard tokens.contains(where: { token in token.id == id && token.sender == sender }) else { return }
        try save(tokens.filter { token in token.id != id })
    }

    // The token of `id` ends, whoever holds it.
    public func release(token id: String) throws {
        guard tokens.contains(where: { token in token.id == id }) else { return }
        try save(tokens.filter { token in token.id != id })
    }

    // MARK: - Private
    private func save(_ next: [CommandToken]) throws {
        let text = String(decoding: try JSONEncoder().encode(next), as: UTF8.self)
        try state.write(reserved: tokensKey, text: text)
        tokens = next
    }

    // The commands the mod declares that can be used, by name.
    private func declared(of mod: Mod) -> [Command] {
        guard case let .object(entries) = mod.contributes[contributionKey] else { return [] }
        return entries.sorted { one, other in one.key < other.key }.compactMap { name, value in
            try? Command(name: name, declared: value)
        }
    }

    // The commands a run registered that can be used.
    private func registered(in contributions: [String: JSONValue]?) -> [Command] {
        written(in: contributions).compactMap { value in try? Command(declared: value) }
    }

    private func written(in contributions: [String: JSONValue]?) -> [JSONValue] {
        guard case let .array(values) = contributions?[contributionKey] else { return [] }
        return values
    }

    private func name(of value: JSONValue) -> String {
        guard case let .object(fields) = value, case let .string(name) = fields["name"] else { return "" }
        return name
    }

    // Whether the holder of `token`, which deckit handed it, owns the interface it was handed for, and its sender
    // declares the entry to it still, with its command and args.
    private func isOwned(_ token: CommandToken) -> Bool {
        guard let holder = token.holder,
            let interface = token.interface,
            let declarations = try? catalog.declarations(to: interface, for: holder)
        else { return false }

        return declarations.contains { declaration in
            guard declaration.mod == token.sender, case let .object(fields) = declaration.entry else { return false }
            return fields["command"] == .string(token.command) && fields["args"] == token.args
        }
    }

    // The command `name` that `mod` declares, which `args` fit, refused with why. Those its run registers are not
    // looked at, so a declaration is checked the same whether the mod runs or not.
    private func checkDeclared(_ name: String, of mod: Mod, args: JSONValue?) throws -> Command {
        guard Provider.isName(name) else { throw CommandError.notAName(name) }
        let provider = Provider.mod(id: mod.manifest.id, name: mod.manifest.name)
        guard let command = declared(of: mod).first(where: { command in command.name == name }) else {
            throw CommandError.noSuchCommand(provider.id(of: name))
        }
        if let why = command.problem(ofArguments: args) {
            throw CommandError.arguments(command: provider.id(of: name), why: why)
        }

        return command
    }

    // An entry declared to `interface` that names no command its mod declares, or one the entry's args do not fit.
    private func problem(ofEntry entry: JSONValue, to interface: String, mod: Mod) -> String? {
        guard case let .object(fields) = entry, let named = fields["command"] else { return nil }
        guard case let .string(command) = named else {
            return "an entry declared to \(interface) names a command that is no name, so it is left out"
        }

        do {
            _ = try checkDeclared(command, of: mod, args: fields["args"])
            return nil
        } catch let refusal as CommandError {
            return "an entry declared to \(interface) is left out: \(refusal.message)"
        } catch {
            return "an entry declared to \(interface) is left out: \(error)"
        }
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
