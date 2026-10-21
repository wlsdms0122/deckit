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
    private let fixture = DeckitFixture("keymap-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a mod's keys are those its run contributed, a global one only with system.global-keys")
    func modKeysComeFromItsRun() throws {
        // Given
        try fixture.write("a", permissions: ["system.global-keys"])
        try fixture.write("b")
        let sut = try fixture.deckit()

        // When
        let a = try sut.started("a", run: 1, keys: [key("find", "mod+shift+f", global: true), key("next", "mod+j")])
        let b = try sut.started("b", run: 1, keys: [key("go", "mod+shift+g", global: true), key("bad", "mod+nope")])

        // Then
        let keymap = try #require(a.keymapChange)
        #expect(keymap.line(of: "a.find") == "a.find active")
        #expect(keymap.line(of: "a.next") == "a.next active")
        #expect(b.keymapChange == nil)
        #expect(b.problem == "key \"go\" cannot be global: that takes the system.global-keys permission")
    }

    @Test("bindings are listed as a keystroke tries them, and a mod's own key hides the app's in its page")
    func keystrokesResolveInOrder() throws {
        // Given
        try fixture.write("a", permissions: ["system.global-keys"])
        let sut = try fixture.deckit()
        _ = sut.keymap.register(appKey("switch", "mod+shift+g", global: true))
        _ = sut.keymap.register(appKey("back", "mod+["))

        // When
        let effects = try sut.started("a", run: 1, keys: [key("summon", "mod+shift+g", global: true), key("prev", "mod+[")])

        // Then
        let keymap = try #require(effects.keymapChange)
        #expect(keymap.bindings.map(\.binding.id) == ["@app.switch", "a.summon", "a.prev", "@app.back"])
        #expect(keymap.line(of: "a.summon") == "a.summon active shadowed:@app.switch")
        #expect(keymap.line(of: "@app.back") == "@app.back active hidden:a.prev")
        #expect(keymap.line(of: "a.prev") == "a.prev active hides:@app.back")
    }

    @Test("a change landing on a chord taken is held, by the order changes were made in, which a restart keeps")
    func laterChangeIsHeld() throws {
        // Given
        let sut = try fixture.deckit()
        for (action, chord) in [("one", "mod+1"), ("two", "mod+2"), ("three", "mod+3")] {
            _ = sut.keymap.register(appKey(action, chord))
        }

        // When
        _ = try sut.keymap.bind("@app.three", spec: "cmd+9")
        let changed = try sut.keymap.bind("@app.two", spec: "Shift+Cmd+9")
        _ = try sut.keymap.bind("@app.two", spec: "cmd+9")
        let restarted = try fixture.deckit()
        var keymap = ResolvedKeymap(revision: 0, bindings: [])
        for (action, chord) in [("one", "mod+1"), ("two", "mod+2"), ("three", "mod+3")] {
            keymap = restarted.keymap.register(appKey(action, chord))
        }

        // Then
        #expect(changed.revision == 5)
        #expect(changed.bindings.first { resolved in resolved.binding.id == "@app.two" }?.binding.keystroke?.spec == "shift+cmd+9")
        #expect(keymap.line(of: "@app.three") == "@app.three active")
        #expect(keymap.line(of: "@app.two") == "@app.two inactive held:@app.three")
    }

    @Test("a binding back to its default keeps no change", arguments: [true, false])
    func bindingGoesBackToItsDefault(resets: Bool) throws {
        // Given
        let sut = try fixture.deckit()
        _ = sut.keymap.register(appKey("one", "mod+1"))
        _ = try sut.keymap.bind("@app.one", spec: "cmd+9")

        // When
        let keymap = resets ? try sut.keymap.reset("@app.one") : try sut.keymap.bind("@app.one", spec: "cmd+1")

        // Then
        let binding = try #require(keymap.bindings.first).binding
        #expect(binding.keystroke?.spec == "cmd+1")
        #expect(binding.changed == false)
    }

    @Test("what cannot be bound is refused, by why")
    func bindRefuses() throws {
        // Given
        let sut = try fixture.deckit()
        _ = sut.keymap.register(appKey("switch", "mod+shift+g", global: true))

        // When
        let refusals = [("@app.none", "cmd+1"), ("@app.switch", "cmd+nope"), ("@app.switch", "cmd+c")].map { id, spec in
            #expect(throws: KeymapError.self) {
                try sut.keymap.bind(id, spec: spec)
            }
        }

        // Then
        let copy = try #require(Keystroke(spec: "cmd+c")).label
        #expect(refusals == [.noSuchBinding("@app.none"), .notAChord("cmd+nope"), .cannotBeGlobal(label: copy)])
    }

    @Test("a run that ends takes its keys with it")
    func endedRunTakesItsKeys() throws {
        // Given
        try fixture.write("a")
        let sut = try fixture.deckit()
        _ = try sut.started("a", run: 1, keys: [key("next", "mod+j")])

        // When
        let terminating = try sut.deck.relaunch("a")
        let ended = try sut.deck.stopped("a", run: 1)

        // Then
        #expect(terminating.keymapChange == nil)
        #expect(try #require(ended.keymapChange).bindings.isEmpty)
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
