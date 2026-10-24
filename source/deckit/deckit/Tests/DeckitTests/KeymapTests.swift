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
    @Test("a mod's keys are those its run contributed, one past its page only with the permission for its scope")
    func modKeysComeFromItsRun() throws {
        // Given
        try fixture.write("a", permissions: ["deckit.app-keys", "system.global-keys"])
        try fixture.write("b", permissions: ["deckit.app-keys"])
        let sut = try fixture.deckit()

        // When
        let a = try sut.started(
            "a",
            run: 1,
            keys: [
                key("find", "mod+shift+f", scope: .app),
                key("call", "alt+space", scope: .global),
                key("next", "mod+j")
            ]
        )
        let b = try sut.started("b", run: 1, keys: [key("go", "mod+shift+g", scope: .global), key("bad", "mod+nope")])

        // Then
        let keymap = try #require(a.keymapChange)
        #expect(keymap.line(of: "a.find") == "a.find active")
        #expect(keymap.line(of: "a.call") == "a.call active")
        #expect(keymap.line(of: "a.next") == "a.next active")
        #expect(b.keymapChange == nil)
        #expect(b.problem == "key \"go\" cannot work in every app: that takes the system.global-keys permission")
    }

    @Test("bindings are listed as a keystroke tries them, the narrowest scope first, and contend only in one scope")
    func keystrokesResolveInOrder() throws {
        // Given
        try fixture.write("a", permissions: ["deckit.app-keys"])
        let sut = try fixture.deckit()
        _ = sut.keymap.register(appKey("switch", "mod+shift+g", scope: .global))
        _ = sut.keymap.register(appKey("find", "mod+shift+f", scope: .app))
        _ = sut.keymap.register(appKey("back", "mod+["))

        // When
        let effects = try sut.started(
            "a",
            run: 1,
            keys: [
                key("summon", "mod+shift+g", scope: .app),
                key("look", "mod+shift+f", scope: .app),
                key("prev", "mod+["),
                key("undo", "mod+z"),
                key("redo", "mod+z")
            ]
        )

        // Then
        let keymap = try #require(effects.keymapChange)
        #expect(
            keymap.bindings.map(\.binding.id)
                == ["a.prev", "a.undo", "a.redo", "@app.back", "@app.find", "a.summon", "a.look", "@app.switch"]
        )
        #expect(keymap.line(of: "a.prev") == "a.prev active")
        #expect(keymap.line(of: "@app.back") == "@app.back active")
        #expect(keymap.line(of: "a.summon") == "a.summon active")
        #expect(keymap.line(of: "@app.switch") == "@app.switch active")
        #expect(keymap.line(of: "a.look") == "a.look active shadowed:@app.find")
        #expect(keymap.line(of: "a.redo") == "a.redo active shadowed:a.undo")
    }

    @Test("a change is held only where a key of its scope has the chord")
    func changeIsHeldInItsScope() throws {
        // Given
        try fixture.write("a")
        let sut = try fixture.deckit()
        _ = sut.keymap.register(appKey("switch", "alt+space", scope: .global))
        _ = sut.keymap.register(appKey("back", "mod+["))
        _ = try sut.started("a", run: 1, keys: [key("prev", "mod+j")])

        // When
        let narrower = try sut.keymap.bind("a.prev", spec: "alt+space")
        let same = try sut.keymap.bind("a.prev", spec: "mod+[")

        // Then
        #expect(narrower.line(of: "a.prev") == "a.prev active")
        #expect(same.line(of: "a.prev") == "a.prev active")
        #expect(try sut.keymap.bind("@app.back", spec: "alt+space").line(of: "@app.back") == "@app.back active")
        #expect(try sut.keymap.bind("@app.back", spec: "mod+k").line(of: "@app.back") == "@app.back active")
        _ = sut.keymap.register(appKey("forward", "mod+j"))
        let held = try sut.keymap.bind("@app.forward", spec: "mod+k")
        #expect(held.line(of: "@app.forward") == "@app.forward inactive held:@app.back")
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

    @Test(
        "what cannot be bound is refused, by why",
        arguments: [
            ("@app.none", "cmd+1", KeymapError.noSuchBinding("@app.none")),
            ("@app.switch", "cmd+nope", .notAChord("cmd+nope")),
            ("@app.switch", "cmd+c", .cannotWork(label: "⌘C", scope: .global))
        ]
    )
    func bindRefuses(id: String, spec: String, refusal: KeymapError) throws {
        // Given
        let sut = try fixture.deckit()
        _ = sut.keymap.register(appKey("switch", "mod+shift+g", scope: .global))

        // When
        let bound = Result { try sut.keymap.bind(id, spec: spec) }

        // Then
        #expect(throws: refusal) { try bound.get() }
    }

    @Test("a run that ends takes its keys with it")
    func endedRunTakesItsKeys() throws {
        // Given
        try fixture.write("a")
        let sut = try fixture.deckit()
        _ = try sut.started("a", run: 1, keys: [key("next", "mod+j")])

        // When
        let terminating = try sut.deck.unload(["a"])
        let ended = try sut.deck.stopped("a", run: 1)

        // Then
        #expect(terminating.keymapChange == nil)
        #expect(try #require(ended.keymapChange).bindings.isEmpty)
    }

    // MARK: - Private
    // A key as a run contributes it.
    private func key(_ action: String, _ spec: String, scope: KeyScope = .local) -> JSONValue {
        .object(
            ["action": .string(action), "key": .string(spec), "label": .string(""), "scope": .string(scope.rawValue)]
        )
    }

    // A key as the app registers it.
    private func appKey(_ action: String, _ spec: String, scope: KeyScope = .local) -> Key {
        Key(action: action, spec: spec, label: "", scope: scope)
    }
}
