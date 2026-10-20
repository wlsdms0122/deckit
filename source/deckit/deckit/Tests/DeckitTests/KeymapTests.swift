//
//  KeymapTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
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
        #expect(b.problem == "key \"go\" cannot be global: that takes the system.global-keys permission")
    }

    @Test("bindings are listed as a keystroke tries them, and a mod's own key hides the app's in its page")
    func testThatKeystrokesResolveInOrder() throws {
        // Given
        try mods.write("a", permissions: ["system.global-keys"])
        let sut = try mods.deckit()
        _ = sut.registerKey(appKey("switch", "mod+shift+g", global: true))
        _ = sut.registerKey(appKey("back", "mod+["))

        // When
        let effects = try sut.started("a", run: 1, keys: [key("summon", "mod+shift+g", global: true), key("prev", "mod+[")])

        // Then
        let keymap = try #require(effects.bindingsChanged)
        #expect(keymap.bindings.map(\.binding.id) == ["@app.switch", "a.summon", "a.prev", "@app.back"])
        #expect(keymap.line(of: "a.summon") == "a.summon active shadowed:@app.switch")
        #expect(keymap.line(of: "@app.back") == "@app.back active hidden:a.prev")
        #expect(keymap.line(of: "a.prev") == "a.prev active hides:@app.back")
    }

    @Test("a change landing on a chord taken is held, by the order changes were made in, which a restart keeps")
    func testThatALaterChangeIsHeld() throws {
        // Given
        let sut = try mods.deckit()
        for (action, chord) in [("one", "mod+1"), ("two", "mod+2"), ("three", "mod+3")] {
            _ = sut.registerKey(appKey(action, chord))
        }

        // When
        _ = try sut.bindKey("@app.three", spec: "cmd+9")
        let changed = try sut.bindKey("@app.two", spec: "Shift+Cmd+9")
        _ = try sut.bindKey("@app.two", spec: "cmd+9")
        let restarted = try mods.deckit()
        var keymap = ResolvedKeymap(revision: 0, bindings: [])
        for (action, chord) in [("one", "mod+1"), ("two", "mod+2"), ("three", "mod+3")] {
            keymap = restarted.registerKey(appKey(action, chord))
        }

        // Then
        #expect(changed.revision == 5)
        #expect(changed.bindings.first { resolved in resolved.binding.id == "@app.two" }?.binding.keystroke?.spec == "shift+cmd+9")
        #expect(keymap.line(of: "@app.three") == "@app.three active")
        #expect(keymap.line(of: "@app.two") == "@app.two inactive held:@app.three")
    }

    @Test("a binding back to its default keeps no change", arguments: [true, false])
    func testThatABindingGoesBackToItsDefault(resets: Bool) throws {
        // Given
        let sut = try mods.deckit()
        _ = sut.registerKey(appKey("one", "mod+1"))
        _ = try sut.bindKey("@app.one", spec: "cmd+9")

        // When
        let keymap = resets ? try sut.resetKey("@app.one") : try sut.bindKey("@app.one", spec: "cmd+1")

        // Then
        let binding = try #require(keymap.bindings.first).binding
        #expect(binding.keystroke?.spec == "cmd+1")
        #expect(binding.changed == false)
    }

    @Test("what cannot be bound is refused, of its kind")
    func testThatBindRefuses() throws {
        // Given
        let sut = try mods.deckit()
        _ = sut.registerKey(appKey("switch", "mod+shift+g", global: true))

        // When
        let refusals = [("@app.none", "cmd+1"), ("@app.switch", "cmd+nope"), ("@app.switch", "cmd+c")].map { id, spec in
            #expect(throws: KeymapError.self) {
                try sut.bindKey(id, spec: spec)
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
        let terminating = try sut.deck.relaunch("a")
        let ended = try sut.deck.stopped("a", run: 1)

        // Then
        #expect(terminating.bindingsChanged == nil)
        #expect(try #require(ended.bindingsChanged).bindings.isEmpty)
    }

    @Test("the keymap reads as the driver keeps it: each binding with its chord, its issues and its keystroke")
    func testThatTheKeymapIsJSON() throws {
        // Given
        let sut = try mods.deckit()
        _ = sut.registerKey(appKey("one", "mod+1"))
        _ = sut.registerKey(appKey("two", "mod+2"))

        // When
        let keymap = try sut.bindKey("@app.two", spec: "cmd+1")
        let json = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(keymap))

        // Then
        guard case let .object(fields) = json, case let .array(bindings)? = fields["bindings"],
            case let .object(two)? = bindings.last, case let .array(issues)? = two["issues"],
            case let .object(held)? = issues.first, case let .object(other)? = held["other"]
        else {
            Issue.record("not a keymap: \(json)")
            return
        }
        let resolved = try #require(keymap.bindings.last).binding
        #expect(fields["revision"] == .number(Double(keymap.revision)))
        #expect(two["id"] == .string("@app.two"))
        #expect(two["key"] == resolved.defaultKeystroke?.spec.map(JSONValue.string))
        #expect(two["spec"] == .string("cmd+1"))
        #expect(two["chord"] == resolved.keystroke.map { keystroke in .string(keystroke.label) })
        #expect(two["changed"] == .bool(true))
        #expect(two["active"] == .bool(false))
        #expect(two["keystroke"] != nil)
        #expect(held["level"] == .string("error"))
        #expect(held["kind"] == .string("held"))
        #expect(other["id"] == .string("@app.one"))
        #expect(other["ownerName"] == .string("App"))
        #expect(other["app"] == .bool(true))
    }

    // MARK: - Private
    // A key as a run contributes it.
    private func key(_ action: String, _ spec: String, global: Bool = false) -> JSONValue {
        .object(["action": .string(action), "key": .string(spec), "label": .string(""), "global": .bool(global)])
    }

    // A key as the app registers it.
    private func appKey(_ action: String, _ spec: String, global: Bool = false) -> Key {
        Key(action: action, spec: spec, label: "", global: global)
    }
}
