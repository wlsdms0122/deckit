//
//  Deckit.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The platform on deck: what it adds, and the deck it is on.
public final class Deckit {
    // MARK: - Property
    public let deck: Deck
    public let keymap: Keymap
    public let commands: CommandRegistry
    public let urlRouter: URLRouter
    public let configuration: Configuration

    // MARK: - Initializer
    // `schemeHandlers` is, by scheme, the mods the app asks first to open an address, and `permissions` those the
    // layers the driver runs define; deckit adds those it checks itself.
    public init(
        home: URL,
        ship: [URL],
        sources: [URL],
        api: Version,
        schemeHandlers: [String: [String]],
        permissions: [Permission]
    ) throws {
        let urls = URLsField()
        let own = [Keymap.appKeysPermission, Keymap.globalKeysPermission]
        let deck = try Deck(
            home: home,
            ship: ship,
            sources: sources,
            api: api,
            permissions: permissions + own,
            fields: [urls]
        )
        let commands = CommandRegistry(deck: deck)
        let keymap = Keymap(deck: deck)
        let urlRouter = URLRouter(deck: deck, field: urls, schemeHandlers: schemeHandlers)
        // Each part keeps the deck it is on; deck asks a part only while it is there, so neither keeps the other.
        deck.add(Layer(
            declarationProblems: { [weak commands] mod in commands?.problems(of: mod) ?? [] },
            problems: { [weak commands] run, mod in commands?.problems(of: run, mod: mod) ?? [] },
            read: { [weak commands] mods in commands?.read(mods) }
        ))
        deck.add(Layer(
            declarationProblems: { [weak keymap] mod in keymap?.problems(of: mod) ?? [] },
            problems: { [weak keymap] run, mod in keymap?.problems(of: run, mod: mod) ?? [] },
            changes: { [weak keymap] in keymap?.changes() ?? [] }
        ))
        deck.add(Layer(problems: { [weak urlRouter] run, mod in urlRouter?.problems(of: run, mod: mod) ?? [] }))
        let configuration = try Configuration(deck: deck)
        deck.add(Layer(
            declarationProblems: { [weak configuration] mod in configuration?.problems(of: mod) ?? [] },
            read: { [weak configuration] mods in configuration?.read(mods) }
        ))
        self.deck = deck
        self.keymap = keymap
        self.commands = commands
        self.urlRouter = urlRouter
        self.configuration = configuration
    }

    // MARK: - Public
    // The provider of `id`: a host that declared a command or registered a key, or a mod deck loads. Nil for neither.
    public func provider(of id: String) -> Provider? {
        if let host = (commands.hosts + keymap.hosts).first(where: { host in host.id == id }) { return host }
        guard let mod = deck.catalog.loading.first(where: { mod in mod.manifest.id == id }) else { return nil }

        return .mod(id: mod.manifest.id, name: mod.manifest.name)
    }

    // What the mods that load declare to `interface`, for its owner `owner`: an entry that names a command its mod
    // declares comes with a token of it `owner` holds as the owner, minted once for each owner and entry, and one that
    // names no command its mod declares, or one its args do not fit, is left out (CommandRegistry tells why as its mod
    // is read). Refused for a mod that does not own `interface`.
    public func contributions(to interface: String, for owner: String) throws -> [InterfaceContribution] {
        try deck.catalog.declarations(to: interface, for: owner).compactMap { declaration in
            guard case let .object(fields) = declaration.entry else { return nil }
            let entry = JSONValue.object(fields.filter { key, _ in key != "command" && key != "args" })
            guard let named = fields["command"] else {
                return InterfaceContribution(mod: declaration.mod, name: declaration.name, entry: entry, token: nil)
            }
            guard case let .string(command) = named,
                let token = try? commands.hand(
                    command,
                    of: declaration.mod,
                    args: fields["args"],
                    to: owner,
                    for: interface
                )
            else {
                return nil
            }

            return InterfaceContribution(mod: declaration.mod, name: declaration.name, entry: entry, token: token.id)
        }
    }

    // MARK: - Private
}
