//
//  CommandTokenTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("CommandToken")
struct CommandTokenTests {
    // MARK: - Property
    private let fixture = DeckitFixture("command-token-tests")
    private let declared: [String: JSONValue] = [
        "commands": .object([
            "open": .object([
                "params": .object([
                    "type": .string("object"),
                    "properties": .object(["url": .object(["type": .string("string")])]),
                    "required": .array([.string("url")])
                ])
            ])
        ])
    ]
    private let args: JSONValue = .object(["url": .string("https://example.com")])

    // MARK: - Initializer
    // MARK: - Test
    @Test("a token of a mod's own command runs that command with the args it was minted with")
    func tokenRunsItsCommand() throws {
        // Given
        try fixture.write("a", contributes: declared)
        let sut = try fixture.deckit()

        // When
        let minted = try sut.commands.mint("open", of: "a", args: args)
        let checked = try sut.commands.check(token: minted.id)

        // Then
        #expect(checked.sender == "a")
        #expect(checked.command == "open")
        #expect(checked.args == args)
        #expect(checked.holder == nil)
    }

    @Test("a token is minted only of a command there, with args that fit it")
    func mintIsRefused() throws {
        // Given
        try fixture.write("a", contributes: declared)
        let sut = try fixture.deckit()

        // When
        let unknown = #expect(throws: CommandError.self) { try sut.commands.mint("close", of: "a", args: nil) }
        let unfit = #expect(throws: CommandError.self) { try sut.commands.mint("open", of: "a", args: nil) }

        // Then
        #expect(unknown == .noSuchCommand("a.close"))
        #expect(unfit?.message.hasPrefix("a.open cannot run") == true)
    }

    @Test("a token ends when its sender cancels it, and only its sender")
    func senderCancels() throws {
        // Given
        try fixture.write("a", contributes: declared)
        try fixture.write("b")
        let sut = try fixture.deckit()
        let minted = try sut.commands.mint("open", of: "a", args: args)

        // When
        try sut.commands.cancel(token: minted.id, of: "b")
        let kept = try sut.commands.check(token: minted.id)
        try sut.commands.cancel(token: minted.id, of: "a")

        // Then
        #expect(kept == minted)
        #expect(throws: CommandError.noSuchToken) { try sut.commands.check(token: minted.id) }
    }

    @Test("a token ends when a holder releases it")
    func holderReleases() throws {
        // Given
        try fixture.write("a", contributes: declared)
        let sut = try fixture.deckit()
        let minted = try sut.commands.mint("open", of: "a", args: args)

        // When
        try sut.commands.release(token: minted.id)

        // Then
        #expect(throws: CommandError.noSuchToken) { try sut.commands.check(token: minted.id) }
        #expect(throws: CommandError.noSuchToken) { try sut.commands.check(token: "made-up") }
    }

    @Test("a token its sender hands over ends once its sender is not found, whichever other mod is")
    func tokenEndsWithItsSender() throws {
        // Given
        try fixture.write("a", contributes: declared)
        try fixture.write("b")
        let sut = try fixture.deckit()
        let handed = try sut.commands.mint("open", of: "a", args: args)

        // When
        try fixture.remove("b")
        _ = sut.deck.readCatalog()
        let kept = try sut.commands.check(token: handed.id)
        try fixture.remove("a")
        _ = sut.deck.readCatalog()

        // Then
        #expect(kept == handed)
        #expect(throws: CommandError.noSuchToken) { try sut.commands.check(token: handed.id) }
    }

    @Test("the tokens are kept across runs of the app")
    func tokensAreKept() throws {
        // Given
        try fixture.write("a", contributes: declared)
        let minted = try fixture.deckit().commands.mint("open", of: "a", args: args)

        // When
        let sut = try fixture.deckit()

        // Then
        #expect(try sut.commands.check(token: minted.id) == minted)
    }

    @Test("a token deckit hands a holder is handed again for the same interface, command and args, and is the holder's")
    func heldTokenIsReused() throws {
        // Given
        try fixture.write("a", contributes: declared)
        try fixture.write("b")
        try fixture.write("c")
        let sut = try fixture.deckit()

        // When
        let first = try sut.commands.hand("open", of: "a", args: args, to: "b", for: "b/actions")
        let again = try sut.commands.hand("open", of: "a", args: args, to: "b", for: "b/actions")
        let elsewhere = try sut.commands.hand("open", of: "a", args: args, to: "b", for: "b/other")
        let other = try sut.commands.hand("open", of: "a", args: args, to: "c", for: "b/actions")
        let handed = try sut.commands.mint("open", of: "a", args: args)

        // Then
        #expect(again == first)
        #expect(first.holder == "b" && first.interface == "b/actions")
        #expect(elsewhere.id != first.id)
        #expect(other.id != first.id)
        #expect(handed.id != first.id)
    }

    @Test("a token of a command its sender no longer has fails as that command is not found")
    func tokenOfGoneCommand() throws {
        // Given
        try fixture.write("a", contributes: declared)
        let minted = try fixture.deckit().commands.mint("open", of: "a", args: args)
        try fixture.write("a", contributes: [:])

        // When
        let sut = try fixture.deckit()

        // Then
        #expect(throws: CommandError.noSuchCommand("a.open")) { try sut.commands.check(token: minted.id) }
    }
}
