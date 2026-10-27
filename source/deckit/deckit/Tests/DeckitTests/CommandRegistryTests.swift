//
//  CommandRegistryTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("CommandRegistry")
struct CommandRegistryTests {
    // MARK: - Property
    private let fixture = DeckitFixture("command-registry-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("the commands are the hosts' as declared, then each running mod's in the load order, each found by its provider")
    func commandsAreTheHostsThenTheRuns() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b")
        let sut = try fixture.deckit()

        // When
        try sut.commands.define([command("toggle-sidebar")], provider: "@host")
        _ = try sut.started("b", run: 1, contributing: ["commands": .array([command("open")])])
        _ = try sut.started("a", run: 1, contributing: ["commands": .array([command("reload"), command("copy")])])
        let listed = sut.commands.list()

        // Then
        #expect(listed.map { registered in registered.provider.id(of: registered.command.name) } == [
            "@host.toggle-sidebar", "a.reload", "a.copy", "b.open"
        ])
        #expect(listed.map(\.provider.isHost) == [true, false, false, false])
        #expect(listed[1].provider.name == "A")
        #expect(sut.provider(of: "@host")?.isHost == true)
        #expect(sut.provider(of: "b") == .mod(id: "b", name: "B"))
        #expect(sut.provider(of: "c") == nil)
    }

    @Test("a declaration that cannot be used is told as the mod starts and left out", arguments: [
        (["name": .string("a.b")], "\"a.b\" is no name: a name has letters, digits, \"_\" and \"-\""),
        (
            ["name": .string("go"), "params": .object(["type": .string("string")])],
            "command \"go\" cannot be used: its \"params\" takes { type: 'object' }"
        ),
        (
            [
                "name": .string("go"),
                "params": .object(["type": .string("object"), "minProperties": .number(1)])
            ],
            "command \"go\" cannot be used: its \"params\" has \"minProperties\", which deckit does not read"
        )
    ] as [([String: JSONValue], String)])
    func declarationIsRefused(declared: [String: JSONValue], problem: String) throws {
        // Given
        try fixture.write("a")
        let sut = try fixture.deckit()

        // When
        let effects = try sut.started("a", run: 1, contributing: ["commands": .array([.object(declared)])])

        // Then
        #expect(effects.problem == problem)
        #expect(sut.commands.list().isEmpty)
    }

    @Test("a command is found by its provider and its name, and checked with args that fit what it takes")
    func checkFindsTheCommandWithArgsThatFit() throws {
        // Given
        try fixture.write("a")
        try fixture.write("a.b")
        let sut = try fixture.deckit()
        let params = JSONValue.object([
            "type": .string("object"),
            "properties": .object([
                "index": .object(["type": .string("integer")]),
                "side": .object(["oneOf": .array([.object(["const": .string("left"), "title": .string("Left")])])])
            ]),
            "required": .array([.string("index")])
        ])
        _ = try sut.started("a", run: 1, contributing: ["commands": .array([
            .object(["name": .string("b")]),
            .object(["name": .string("show-tab"), "description": .string("Shows a tab"), "params": params])
        ])])
        _ = try sut.started("a.b", run: 1, contributing: ["commands": .array([command("c")])])

        // When
        let found = try sut.commands.check("show-tab", of: "a", args: .object(["index": .number(2)]))
        let unfilled = try sut.commands.find("show-tab", of: "a")
        let refusals = [
            ("b.c", "a", nil),
            ("c", "a", nil),
            ("show-tab", "a", .object([:])),
            ("show-tab", "a", .object(["index": .number(1.5)])),
            ("show-tab", "a", .object(["index": .number(0), "side": .string("right")])),
            ("b", "a", .object(["index": .number(0)]))
        ].map { name, provider, args in refusal(sut, name, of: provider, args: args) }

        // Then
        #expect(found.command.description == "Shows a tab")
        #expect(unfilled.command.description == "Shows a tab")
        #expect(refusals == [
            "\"b.c\" is no name: a name has letters, digits, \"_\" and \"-\"",
            "no such command: a.c",
            "a.show-tab cannot run: args needs \"index\"",
            "a.show-tab cannot run: args.index is not an integer",
            "a.show-tab cannot run: args.side is not one of what it takes",
            "a.b cannot run: it takes no args"
        ])
    }

    @Test("a host declares each of its names once, under a name that starts with @")
    func hostDeclaresEachNameOnce() throws {
        // Given
        let sut = try fixture.deckit()
        try sut.commands.define([command("show")], provider: "@host")

        // When
        let again = refusal { try sut.commands.define([command("show")], provider: "@host") }
        let unnamed = refusal { try sut.commands.define([command("show")], provider: "host") }
        let other = refusal { try sut.commands.define([command("show")], provider: "@app") }

        // Then
        #expect(again == "@host.show is declared already")
        #expect(unnamed == "\"host\" is no name: a name has letters, digits, \"_\" and \"-\"")
        #expect(other == nil)
    }

    // MARK: - Private
    private func command(_ name: String) -> JSONValue {
        .object(["name": .string(name)])
    }

    private func refusal(_ sut: Deckit, _ name: String, of provider: String, args: JSONValue?) -> String? {
        refusal { _ = try sut.commands.check(name, of: provider, args: args) }
    }

    private func refusal(_ body: () throws -> Void) -> String? {
        do {
            try body()
            return nil
        } catch let refusal as CommandError {
            return refusal.message
        } catch {
            return "\(error)"
        }
    }
}
