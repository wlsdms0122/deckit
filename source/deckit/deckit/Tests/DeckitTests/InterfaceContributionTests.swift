//
//  InterfaceContributionTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("InterfaceContribution")
struct InterfaceContributionTests {
    // MARK: - Property
    private let fixture = DeckitFixture("interface-contribution-tests")
    private let commands: JSONValue = .object([
        "open": .object([
            "params": .object([
                "type": .string("object"),
                "properties": .object(["x": .object(["type": .string("number")])])
            ])
        ])
    ])

    // MARK: - Initializer
    // MARK: - Test
    @Test("the owner is handed each entry declared to its interface, with a token of the command it names")
    func ownerPullsDeclarations() throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("a", contributes: [
            "commands": commands,
            "interfaces": .object(["o/actions": .array([
                .object(["title": .string("Open"), "command": .string("open"), "args": .object(["x": .number(1)])]),
                .object(["title": .string("Note")])
            ])])
        ])
        let sut = try fixture.deckit()

        // When
        let handed = try sut.contributions(to: "o/actions", for: "o")
        let token = try sut.commands.check(token: try #require(handed.first?.token))

        // Then
        #expect(handed.map(\.mod) == ["a", "a"])
        #expect(handed.map(\.name) == ["A", "A"])
        #expect(handed.map(\.entry) == [.object(["title": .string("Open")]), .object(["title": .string("Note")])])
        #expect(handed[1].token == nil)
        #expect(token.sender == "a" && token.command == "open" && token.holder == "o")
        #expect(token.args == .object(["x": .number(1)]))
    }

    @Test("what is declared to an interface is handed to its owner only")
    func notOwnerIsRefused() throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("a", contributes: ["interfaces": .object(["o/actions": .array([.object([:])])])])
        let sut = try fixture.deckit()

        // When
        let refused = #expect(throws: DeclarationError.self) { try sut.contributions(to: "o/actions", for: "a") }

        // Then
        #expect(refused == .notOwner(interface: "o/actions", mod: "a"))
    }

    @Test("a new owner is handed its own tokens, and the old owner's last until it is removed")
    func newOwnerGetsItsOwnTokens() throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("p", provides: ["o/actions"])
        try fixture.write("a", contributes: [
            "commands": commands,
            "interfaces": .object(["o/actions": .array([.object(["command": .string("open")])])])
        ])
        let sut = try fixture.deckit()
        let first = try #require(try sut.contributions(to: "o/actions", for: "o").first?.token)

        // When
        try sut.deck.catalog.pin("o/actions", to: "p")
        _ = sut.deck.readCatalog()
        let second = try #require(try sut.contributions(to: "o/actions", for: "p").first?.token)
        let again = try sut.contributions(to: "o/actions", for: "p").first?.token
        let kept = try sut.commands.check(token: first)
        try fixture.remove("o")
        _ = sut.deck.readCatalog()

        // Then
        #expect(second != first)
        #expect(again == second)
        #expect(kept.holder == "o")
        #expect(throws: CommandError.noSuchToken) { try sut.commands.check(token: first) }
        #expect(try sut.commands.check(token: second).holder == "p")
    }

    @Test("an entry that names a command its mod cannot run is left out, and told as its mod is read")
    func entryOfUnknownCommandIsLeftOut() throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("a", contributes: [
            "commands": commands,
            "interfaces": .object(["o/actions": .array([
                .object(["command": .string("missing")]),
                .object(["command": .string("open")])
            ])])
        ])
        let sut = try fixture.deckit()

        // When
        let handed = try sut.contributions(to: "o/actions", for: "o")
        let problems = sut.deck.readCatalog().first { mod in mod.manifest.id == "a" }?.declarationProblems

        // Then
        #expect(handed.count == 1)
        #expect(problems == ["an entry declared to o/actions is left out: no such command: a.missing"])
    }

    @Test("an entry that names a command only its run registers is left out and told, whether the mod runs or not")
    func entryOfRegisteredCommandIsLeftOut() throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("a", contributes: [
            "interfaces": .object(["o/actions": .array([.object(["command": .string("live")])])])
        ])
        let sut = try fixture.deckit()
        let problem = "an entry declared to o/actions is left out: no such command: a.live"

        // When
        let idle = sut.deck.readCatalog().first { mod in mod.manifest.id == "a" }?.declarationProblems
        let idleHanded = try sut.contributions(to: "o/actions", for: "o")
        _ = try sut.started("a", run: 1, contributing: ["commands": .array([.object(["name": .string("live")])])])
        let registered = try sut.commands.find("live", of: "a")
        let running = sut.deck.readCatalog().first { mod in mod.manifest.id == "a" }?.declarationProblems
        let runningHanded = try sut.contributions(to: "o/actions", for: "o")

        // Then
        #expect(registered.command.name == "live")
        #expect(idle == [problem])
        #expect(running == [problem])
        #expect(idleHanded.isEmpty)
        #expect(runningHanded.isEmpty)
    }

    @Test("declarations that are not entry lists by interface are told as the mod is read and left out", arguments: [
        (.array([]), "contributes \"interfaces\" must be an object of entry lists by interface"),
        (
            .object(["o/actions": .array([.string("x")])]),
            "contributes \"interfaces\" \"o/actions\" must be a list of objects"
        )
    ] as [(JSONValue, String)])
    func malformedDeclarationIsTold(declared: JSONValue, problem: String) throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("a", contributes: ["interfaces": declared])
        let sut = try fixture.deckit()

        // When
        let problems = sut.deck.readCatalog().first { mod in mod.manifest.id == "a" }?.declarationProblems

        // Then
        #expect(problems == [problem])
        #expect(try sut.contributions(to: "o/actions", for: "o").isEmpty)
    }

    @Test("a mod that listens hears <interface>:contributions-changed as what is declared to it changes")
    func changeIsDelivered() throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("a")
        let sut = try fixture.deckit()
        sut.deck.events.listen(mod: "o", run: 1, names: ["o/actions:contributions-changed"])
        let quiet = sut.deck.reconnect()

        // When
        try fixture.write("a", contributes: ["interfaces": .object(["o/actions": .array([.object([:])])])])
        _ = sut.deck.readCatalog()
        let installed = sut.deck.reconnect()
        let again = sut.deck.reconnect()
        try fixture.remove("a")
        _ = sut.deck.readCatalog()
        let removed = sut.deck.reconnect()

        // Then
        #expect(!quiet.contains(where: delivers))
        #expect(installed.filter(delivers).count == 1)
        #expect(!again.contains(where: delivers))
        #expect(removed.filter(delivers).count == 1)
    }

    // MARK: - Private
    private func delivers(_ effect: Effect) -> Bool {
        guard case let .deliver(delivery) = effect else { return false }
        return delivery.name == "o/actions:contributions-changed" && delivery.listeners == ["o"]
    }
}
