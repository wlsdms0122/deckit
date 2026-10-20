//
//  KeymapTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
import Deck
@testable import Deckit

@Suite("Keymap")
struct KeymapTests {
    // MARK: - Property
    private let mods = ModHome("keymap-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a mod's keys are those its run contributed, a global one only with system.global-keys")
    func testThatModKeysComeFromItsRun() throws {
        // Given
        try mods.write("a", permissions: ["system.global-keys"])
        try mods.write("b")
        let sut = try mods.deckit()

        // When
        let a = try sut.started("a", run: 1, keys: [key("find", "mod+shift+f", global: true), key("next", "mod+j")])
        let b = try sut.started("b", run: 1, keys: [key("go", "mod+shift+g", global: true), key("bad", "mod+nope")])

        // Then
        let keymap = try #require(a.bindingsChanged)
        #expect(keymap.line(of: "a.find") == "a.find active")
        #expect(keymap.line(of: "a.next") == "a.next active")
        #expect(b.bindingsChanged == nil)
        let problem = b.array.compactMap { effect in effect["problem"]?.string }.first
        #expect(problem == "key \"go\" cannot be global: that takes the system.global-keys permission")
    }

    @Test("bindings are listed as a keystroke tries them, and a mod's own key hides the app's in its page")
    func testThatKeystrokesResolveInOrder() throws {
        // Given
        try mods.write("a", permissions: ["system.global-keys"])
        let sut = try mods.deckit()
        _ = try sut.json("keymap/register", key("switch", "mod+shift+g", global: true))
        _ = try sut.json("keymap/register", key("back", "mod+["))

        // When
        let effects = try sut.started("a", run: 1, keys: [key("summon", "mod+shift+g", global: true), key("prev", "mod+[")])

        // Then
        let keymap = try #require(effects.bindingsChanged)
        #expect(keymap.array.compactMap { binding in binding["id"]?.string } == ["@app.switch", "a.summon", "a.prev", "@app.back"])
        #expect(keymap.line(of: "a.summon") == "a.summon active shadowed:@app.switch")
        #expect(keymap.line(of: "@app.back") == "@app.back active hidden:a.prev")
        #expect(keymap.line(of: "a.prev") == "a.prev active hides:@app.back")
    }

    @Test("a change landing on a chord taken is held, by the order changes were made in, which a restart keeps")
    func testThatALaterChangeIsHeld() throws {
        // Given
        let sut = try mods.deckit()
        for (action, chord) in [("one", "mod+1"), ("two", "mod+2"), ("three", "mod+3")] {
            _ = try sut.json("keymap/register", key(action, chord))
        }

        // When
        _ = try sut.json("keymap/bind", .object(["id": .string("@app.three"), "spec": .string("cmd+9")]))
        let changed = try sut.json("keymap/bind", .object(["id": .string("@app.two"), "spec": .string("Shift+Cmd+9")]))
        let revision = changed["revision"]
        _ = try sut.json("keymap/bind", .object(["id": .string("@app.two"), "spec": .string("cmd+9")]))
        let restarted = try mods.deckit()
        var keymap = JSONValue.array([])
        for (action, chord) in [("one", "mod+1"), ("two", "mod+2"), ("three", "mod+3")] {
            keymap = try restarted.json("keymap/register", key(action, chord))["bindings"] ?? .null
        }

        // Then
        #expect(revision == .number(5))
        #expect(changed["bindings"]?.array.first { binding in binding["id"]?.string == "@app.two" }?["spec"]?.string == "shift+cmd+9")
        #expect(keymap.line(of: "@app.three") == "@app.three active")
        #expect(keymap.line(of: "@app.two") == "@app.two inactive held:@app.three")
    }

    @Test("a binding back to its default keeps no change", arguments: ["keymap/reset", "keymap/bind"])
    func testThatABindingGoesBackToItsDefault(method: String) throws {
        // Given
        let sut = try mods.deckit()
        _ = try sut.json("keymap/register", key("one", "mod+1"))
        _ = try sut.json("keymap/bind", .object(["id": .string("@app.one"), "spec": .string("cmd+9")]))

        // When
        let keymap = try sut.json(method, .object(["id": .string("@app.one"), "spec": .string("cmd+1")]))

        // Then
        let binding = try #require(keymap["bindings"]?.array.first)
        #expect(binding["spec"]?.string == "cmd+1")
        #expect(binding["changed"]?.bool == false)
    }

    @Test("what cannot be bound is refused, of its kind")
    func testThatBindRefuses() throws {
        // Given
        let sut = try mods.deckit()
        _ = try sut.json("keymap/register", key("switch", "mod+shift+g", global: true))

        // When
        let refusals = [("@app.none", "cmd+1"), ("@app.switch", "cmd+nope"), ("@app.switch", "cmd+c")].map { id, spec in
            #expect(throws: KeymapError.self) {
                try sut.json("keymap/bind", .object(["id": .string(id), "spec": .string(spec)]))
            }
        }

        // Then
        #expect(refusals.map { error in error?.kind } == ["SHORTCUT", "CHORD", "REFUSED"])
    }

    @Test("a run that ends takes its keys with it")
    func testThatAnEndedRunTakesItsKeys() throws {
        // Given
        try mods.write("a")
        let sut = try mods.deckit()
        _ = try sut.started("a", run: 1, keys: [key("next", "mod+j")])

        // When
        let terminating = try sut.json("runner/relaunch", .object(["mod": .string("a")]))
        let ended = try sut.json("runner/stopped", .object(["mod": .string("a"), "run": .number(1)]))

        // Then
        #expect(terminating.bindingsChanged == nil)
        #expect(try #require(ended.bindingsChanged).array.isEmpty)
    }

    // MARK: - Private
    private func key(_ action: String, _ spec: String, global: Bool = false) -> JSONValue {
        .object(["action": .string(action), "key": .string(spec), "label": .string(""), "global": .bool(global)])
    }
}
