//
//  ConfigurationTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/27/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("Configuration")
struct ConfigurationTests {
    // MARK: - Property
    private let fixture = DeckitFixture("configuration-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a value set is saved among the mod's others, as JSON, and read back")
    func valueIsSavedAmongOthers() throws {
        // Given
        let sut = try deckit(["notes", "finder"])
        _ = try sut.configuration.declare([boolean("wrap"), number("size"), string("font")], mod: "notes", run: 1)
        _ = try sut.configuration.set(mod: "notes", key: "wrap", value: .bool(true))
        _ = try sut.configuration.set(mod: "notes", key: "size", value: .number(14))

        // When
        _ = try sut.configuration.set(mod: "notes", key: "font", value: .string("Menlo"))

        // Then
        #expect(
            sut.configuration.values(of: "notes") == ["wrap": .bool(true), "size": .number(14), "font": .string("Menlo")]
        )
        #expect(sut.configuration.values(of: "finder").isEmpty)
        #expect(sut.deck.modState.read("configuration", mod: "notes") == #"{"font":"Menlo","size":14,"wrap":true}"#)
    }

    @Test("setting says what the value is now and whether that changed it")
    func setSaysWhetherChanged() throws {
        // Given
        let sut = try deckit(["notes"])
        _ = try sut.configuration.declare([number("size")], mod: "notes", run: 1)
        _ = try sut.configuration.set(mod: "notes", key: "size", value: .number(14))

        // When
        let same = try sut.configuration.set(mod: "notes", key: "size", value: .number(14))
        let changed = try sut.configuration.set(mod: "notes", key: "size", value: .number(15))

        // Then
        #expect(same == ConfigurationChange(value: .number(14), changed: false))
        #expect(changed == ConfigurationChange(value: .number(15), changed: true))
    }

    @Test("a value saved that its declaration does not take reads as the default, stays saved and is a problem")
    func valueNotTakenReadsAsDefault() throws {
        // Given
        let sut = try deckit(["notes"])
        let theme = declaration(
            ["key": .string("theme"), "type": .string("string"), "default": .string("light"), "oneOf": choices]
        )
        try sut.deck.modState.write("configuration", mod: "notes", text: #"{"size":99,"theme":"blue","wrap":1}"#)

        // When
        let effects = try sut.configuration.declare([boolean("wrap"), number("size"), theme], mod: "notes", run: 1)

        // Then
        #expect(sut.configuration.values(of: "notes") == ["size": .number(12), "theme": .string("light")])
        #expect(effects.problem == #"configuration "size" does not take 99, which is saved: it reads as its default"#)
        #expect(sut.deck.modState.read("configuration", mod: "notes") == #"{"size":99,"theme":"blue","wrap":1}"#)
    }

    @Test("a value saved for what the mod does not declare is not handed back, and is a problem")
    func undeclaredValueIsAProblem() throws {
        // Given
        let sut = try deckit(["notes"])
        try sut.deck.modState.write("configuration", mod: "notes", text: #"{"gone":true}"#)

        // When
        let effects = try sut.configuration.declare([boolean("wrap")], mod: "notes", run: 1)

        // Then
        #expect(sut.configuration.values(of: "notes").isEmpty)
        #expect(effects.problem == #"configuration "gone" is saved, and the mod does not declare it"#)
    }

    @Test("a text saved that is not a table of values reads as none saved")
    func unreadableTextReadsAsNone() throws {
        // Given
        let sut = try deckit(["notes"])
        try sut.deck.modState.write("configuration", mod: "notes", text: "[1,2]")

        // When
        _ = try sut.configuration.declare([number("size")], mod: "notes", run: 1)

        // Then
        #expect(sut.configuration.values(of: "notes") == ["size": .number(12)])
    }

    @Test("only the mod's latest run declares, while it launches")
    func onlyTheLaunchingRunDeclares() throws {
        // Given
        let sut = try deckit(["notes", "finder"])

        // When
        _ = try sut.configuration.declare([boolean("wrap")], mod: "notes", run: 0)
        _ = try sut.configuration.declare([boolean("wrap")], mod: "finder", run: 1)
        _ = try sut.started("finder", run: 1, contributing: [:])
        _ = try sut.configuration.declare([boolean("hidden")], mod: "finder", run: 1)
        let wrap = Result { try sut.configuration.set(mod: "notes", key: "wrap", value: .bool(true)) }
        let hidden = Result { try sut.configuration.set(mod: "finder", key: "hidden", value: .bool(true)) }

        // Then
        #expect(throws: ConfigurationError.undeclared(mod: "notes", key: "wrap")) { try wrap.get() }
        #expect(throws: ConfigurationError.undeclared(mod: "finder", key: "hidden")) { try hidden.get() }
        #expect(sut.configuration.values(of: "finder") == [:])
    }

    @Test(
        "a declaration deckit does not read is left out, and is a problem, the rest kept",
        arguments: [
            (
                ["key": JSONValue.string("shade"), "type": .string("slider")],
                #"configuration "shade": deckit does not read its type"#
            ),
            (
                ["key": .string("font"), "type": .string("string"), "title": .number(1)],
                #"configuration "font": deckit does not read its title"#
            ),
            (
                ["key": .string("size"), "type": .string("number"), "default": .string("12")],
                #"configuration "size": deckit does not read its default"#
            ),
            (
                ["key": .string("theme"), "type": .string("boolean"), "oneOf": .array([.object(["const": .string("x")])])],
                #"configuration "theme": deckit does not read its oneOf"#
            )
        ]
    )
    func unreadDeclarationIsAProblem(fields: [String: JSONValue], problem: String) throws {
        // Given
        let sut = try deckit(["notes"])

        // When
        let effects = try sut.configuration.declare([boolean("wrap"), .object(fields)], mod: "notes", run: 1)
        let wrap = Result { try sut.configuration.set(mod: "notes", key: "wrap", value: .bool(true)) }

        // Then
        #expect(throws: Never.self) { try wrap.get() }
        #expect(effects.problem == problem)
    }

    @Test("a value is set as its declaration takes it, and a number within its bounds")
    func valueIsSetAsDeclared() throws {
        // Given
        let sut = try deckit(["notes"])
        let theme = declaration(["key": .string("theme"), "type": .string("string"), "oneOf": choices])
        _ = try sut.configuration.declare([boolean("wrap"), number("size"), string("font"), theme], mod: "notes", run: 1)

        // When
        let size = try sut.configuration.set(mod: "notes", key: "size", value: .number(99))
        let chosen = try sut.configuration.set(mod: "notes", key: "theme", value: .string("dark"))

        // Then
        #expect(size.value == .number(32))
        #expect(chosen.value == .string("dark"))
    }

    @Test(
        "a value its declaration does not take is refused",
        arguments: [
            ("wrap", ConfigurationValue?.some(.number(1)), ConfigurationError.notOfType(key: "wrap", type: .boolean)),
            ("size", .string("12"), .notOfType(key: "size", type: .number)),
            ("font", nil, .notOfType(key: "font", type: .string)),
            ("theme", .string("blue"), .notAChoice(key: "theme", value: .string("blue")))
        ]
    )
    func valueOutsideItsDeclarationIsRefused(
        key: String,
        value: ConfigurationValue?,
        refusal: ConfigurationError
    ) throws {
        // Given
        let sut = try deckit(["notes"])
        let theme = declaration(["key": .string("theme"), "type": .string("string"), "oneOf": choices])
        _ = try sut.configuration.declare([boolean("wrap"), number("size"), string("font"), theme], mod: "notes", run: 1)

        // When
        let set = Result { try sut.configuration.set(mod: "notes", key: key, value: value) }

        // Then
        #expect(throws: refusal) { try set.get() }
    }

    @Test("the list has every loading mod's that declared any, in the catalog's order, with the values they read as")
    func listHasDeclaredConfiguration() throws {
        // Given
        let sut = try deckit(["notes", "finder", "editor"])
        let theme = declaration(
            ["key": .string("theme"), "type": .string("string"), "default": .string("light"), "oneOf": choices]
        )
        _ = try sut.configuration.declare([theme, number("size"), string("font")], mod: "notes", run: 1)
        _ = try sut.configuration.declare([], mod: "finder", run: 1)
        _ = try sut.configuration.declare([boolean("wrap")], mod: "editor", run: 1)
        _ = try sut.configuration.set(mod: "notes", key: "size", value: .number(14))

        // When
        let groups = sut.configuration.list()

        // Then
        #expect(groups.map(\.id) == ["editor", "notes"])
        let items = try #require(groups.last?.items)
        #expect(items.map(\.declaration.key) == ["theme", "size", "font"])
        #expect(items.map(\.value) == [.string("light"), .number(14), nil])
        #expect(items[0].declaration.oneOf.map(\.value) == [.string("light"), .string("dark")])
    }

    @Test("what a mod that no longer loads declared is neither listed nor set")
    func whatNoLongerLoadsIsLeftOut() throws {
        // Given
        let sut = try deckit(["notes", "finder"])
        _ = try sut.configuration.declare([boolean("wrap")], mod: "notes", run: 1)
        _ = try sut.configuration.declare([boolean("wrap")], mod: "finder", run: 1)
        try fixture.remove("notes")

        // When
        _ = sut.deck.readCatalog()
        let wrap = Result { try sut.configuration.set(mod: "notes", key: "wrap", value: .bool(true)) }

        // Then
        #expect(sut.configuration.list().map(\.id) == ["finder"])
        #expect(throws: ConfigurationError.undeclared(mod: "notes", key: "wrap")) { try wrap.get() }
    }

    @Test("a declaration reads as a subset of JSON Schema")
    func declarationIsJSONSchema() throws {
        // Given
        let text = #"[{"key":"theme","type":"string","title":"Theme","description":"How it looks","#
            + #""default":"light","oneOf":[{"const":"light","title":"Light"},{"const":"dark"}]},"#
            + #"{"key":"size","type":"number","minimum":8,"maximum":32}]"#

        // When
        let sut = try JSONDecoder().decode([ConfigurationDeclaration].self, from: Data(text.utf8))

        // Then
        let theme = ConfigurationDeclaration(
            key: "theme",
            type: .string,
            title: "Theme",
            description: "How it looks",
            defaultValue: .string("light"),
            oneOf: [
                ConfigurationChoice(value: .string("light"), title: "Light"),
                ConfigurationChoice(value: .string("dark"))
            ]
        )
        let size = ConfigurationDeclaration(key: "size", type: .number, minimum: 8, maximum: 32)
        #expect(sut == [theme, size])
    }

    // MARK: - Private
    private var choices: JSONValue {
        .array([.object(["const": .string("light")]), .object(["const": .string("dark")])])
    }

    // Each mod written, read and launching its first run.
    private func deckit(_ ids: [String]) throws -> Deckit {
        for id in ids {
            try fixture.write(id)
        }
        return try fixture.deckit()
    }

    private func declaration(_ fields: [String: JSONValue]) -> JSONValue {
        .object(fields)
    }

    private func boolean(_ key: String) -> JSONValue {
        .object(["key": .string(key), "type": .string("boolean")])
    }

    private func number(_ key: String) -> JSONValue {
        .object([
            "key": .string(key),
            "type": .string("number"),
            "default": .number(12),
            "minimum": .number(8),
            "maximum": .number(32)
        ])
    }

    private func string(_ key: String) -> JSONValue {
        .object(["key": .string(key), "type": .string("string")])
    }
}
