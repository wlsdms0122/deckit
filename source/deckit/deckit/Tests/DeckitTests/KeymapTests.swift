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
        _ = try register(sut, "switch", "mod+shift+g", scope: .global)
        _ = try register(sut, "find", "mod+shift+f", scope: .app)
        _ = try register(sut, "back", "mod+[")

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
        _ = try register(sut, "switch", "alt+space", scope: .global)
        _ = try register(sut, "back", "mod+[")
        _ = try sut.started("a", run: 1, keys: [key("prev", "mod+j")])

        // When
        let narrower = try sut.keymap.bind("a.prev", spec: "alt+space")
        let same = try sut.keymap.bind("a.prev", spec: "mod+[")

        // Then
        #expect(narrower.line(of: "a.prev") == "a.prev active")
        #expect(same.line(of: "a.prev") == "a.prev active")
        #expect(try sut.keymap.bind("@app.back", spec: "alt+space").line(of: "@app.back") == "@app.back active")
        #expect(try sut.keymap.bind("@app.back", spec: "mod+k").line(of: "@app.back") == "@app.back active")
        _ = try register(sut, "forward", "mod+j")
        let held = try sut.keymap.bind("@app.forward", spec: "mod+k")
        #expect(held.line(of: "@app.forward") == "@app.forward inactive held:@app.back")
    }

    @Test("a change landing on a chord taken is held, by the order changes were made in, which a restart keeps")
    func laterChangeIsHeld() throws {
        // Given
        let sut = try fixture.deckit()
        for (action, chord) in [("one", "mod+1"), ("two", "mod+2"), ("three", "mod+3")] {
            _ = try register(sut, action, chord)
        }

        // When
        _ = try sut.keymap.bind("@app.three", spec: "cmd+9")
        let changed = try sut.keymap.bind("@app.two", spec: "Shift+Cmd+9")
        _ = try sut.keymap.bind("@app.two", spec: "cmd+9")
        let restarted = try fixture.deckit()
        var keymap = ResolvedKeymap(revision: 0, bindings: [])
        for (action, chord) in [("one", "mod+1"), ("two", "mod+2"), ("three", "mod+3")] {
            keymap = try register(restarted, action, chord)
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
        _ = try register(sut, "one", "mod+1")
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
        _ = try register(sut, "switch", "mod+shift+g", scope: .global)

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

    @Test("a key runs a command its run declared, with args that fit, and is called by the command's label without")
    func keyRunsADeclaredCommand() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b")
        try fixture.write("c")
        let sut = try fixture.deckit()
        let params = JSONValue.object([
            "type": .string("object"),
            "properties": .object(["index": .object(["type": .string("integer")])]),
            "required": .array([.string("index")])
        ])
        let commands = JSONValue.array([
            .object(["name": .string("show-tab"), "label": .string("Show Tab"), "params": params]),
            .object(["name": .string("new-tab"), "label": .string("New Tab")])
        ])
        let tab = { (name: String, command: String, args: JSONValue?, label: String) in
            var key: [String: JSONValue] = [
                "name": .string(name),
                "command": .string(command),
                "key": .string("mod+1"),
                "label": .string(label),
                "scope": .string("local")
            ]
            key["args"] = args
            return JSONValue.object(key)
        }

        // When
        let a = try sut.started("a", run: 1, contributing: [
            "commands": commands,
            "keys": .array([tab("tab1", "show-tab", .object(["index": .number(0)]), "Tab 1"), tab("new", "new-tab", nil, "")])
        ])
        let b = try sut.started("b", run: 1, contributing: [
            "commands": commands,
            "keys": .array([tab("tab1", "show-tab", .object([:]), "Tab 1")])
        ])
        let c = try sut.started("c", run: 1, contributing: [
            "commands": commands,
            "keys": .array([tab("new", "new-tab", nil, "New"), tab("gone", "close-tab", nil, "")])
        ])

        // Then
        let keymap = try #require(a.keymapChange)
        let labels = keymap.bindings.map { resolved in "\(resolved.binding.id) \(resolved.binding.label)" }
        #expect(labels == ["a.tab1 Tab 1", "a.new New Tab"])
        #expect(b.problem == "key \"tab1\" cannot be used: its args do not fit \"show-tab\": args needs \"index\"")
        #expect(c.problem == KeymapError.labelWithoutArguments("new").message)
    }

    // MARK: - Private
    // A key as a run contributes it.
    private func key(_ name: String, _ spec: String, scope: KeyScope = .local) -> JSONValue {
        .object(
            [
                "name": .string(name),
                "command": .string(name),
                "key": .string(spec),
                "label": .string(""),
                "scope": .string(scope.rawValue)
            ]
        )
    }

    // A key as the app registers it.
    // A key of the host's, run by a command of the same name it declares first.
    private func register(
        _ sut: Deckit,
        _ name: String,
        _ spec: String,
        scope: KeyScope = .local
    ) throws -> ResolvedKeymap {
        try sut.commands.define([.object(["name": .string(name), "label": .string(name)])], owner: "@app")
        return try sut.keymap.register(
            Key(name: name, command: name, args: nil, spec: spec, label: "", scope: scope),
            owner: "@app"
        )
    }
}
