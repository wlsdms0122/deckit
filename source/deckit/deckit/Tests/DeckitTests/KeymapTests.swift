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

    @Test("a mod's declared app and global keys are bound whether it runs or not, before those its run registers")
    func declaredKeysAreBound() throws {
        // Given
        let find: JSONValue = .object(["label": .string("Find"), "key": .string("mod+shift+f"), "scope": .string("app")])
        try fixture.write("a", permissions: ["deckit.app-keys"], contributes: ["keys": .object(["find": find])])
        let sut = try fixture.deckit()

        // When
        let declared = try sut.keymap.reset("a.none")
        let running = try sut.started("a", run: 1, keys: [key("find", "mod+g", scope: .app), key("next", "mod+j")])

        // Then
        #expect(declared.bindings.map { resolved in resolved.binding.id } == ["a.find"])
        let keymap = try #require(running.keymapChange)
        #expect(keymap.bindings.map { resolved in "\(resolved.binding.id) \(resolved.binding.label)" } == [
            "a.next Next", "a.find Find"
        ])
        #expect(keymap.line(of: "a.find") == "a.find active")
        #expect(running.problem == nil)
    }

    @Test("a declared key that cannot be used is told as the mod is read and left out", arguments: [
        (
            ["keys": .object(["find": .object(["label": .string("Find"), "key": .string("mod+f"), "scope": .string("local")])])],
            "key \"find\" cannot be declared: a local key is registered with what the mod shows"
        ),
        (
            ["keys": .object(["find": .object(["label": .string("Find"), "key": .string("mod+f")])])],
            "key \"find\" cannot be used: it needs { label, key, scope }"
        ),
        (
            ["keys": .object(["find": .object(["label": .string("Find"), "key": .string("mod+f"), "scope": .string("global")])])],
            "key \"find\" cannot work in every app: that takes the system.global-keys permission"
        ),
        (["keys": .array([])], "contributes \"keys\" must be an object of keys by name")
    ] as [([String: JSONValue], String)])
    func declaredKeyIsRefused(contributes: [String: JSONValue], problem: String) throws {
        // Given
        try fixture.write("a", contributes: contributes)
        let sut = try fixture.deckit()

        // When
        let problems = sut.readCatalog().first { mod in mod.manifest.id == "a" }?.declarationProblems

        // Then
        #expect(problems == [problem])
        #expect(try sut.keymap.reset("a.none").bindings.isEmpty)
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
        let terminating = sut.outcome(try sut.unload(["a"]))
        let ended = sut.outcome(try sut.stopped("a", run: 1))

        // Then
        #expect(terminating.keymapChange == nil)
        #expect(try #require(ended.keymapChange).bindings.isEmpty)
    }

    @Test("a key needs a label and a chord, and a host's are registered under a name that starts with @")
    func keyNeedsALabel() throws {
        // Given
        try fixture.write("a")
        let sut = try fixture.deckit()
        let unlabeled = JSONValue.object([
            "name": .string("new"),
            "key": .string("mod+n"),
            "label": .string(""),
            "scope": .string("local")
        ])

        // When
        let a = try sut.started("a", run: 1, keys: [key("tab1", "mod+1"), unlabeled])
        let unnamed = Result { try sut.keymap.register(Key(name: "go", label: "Go", spec: "mod+g", scope: .local), provider: "app", name: "App") }
        let blank = Result { try sut.keymap.register(Key(name: "go", label: "", spec: "mod+g", scope: .local), provider: "@app", name: "App") }

        // Then
        let keymap = try #require(a.keymapChange)
        #expect(keymap.bindings.map { resolved in "\(resolved.binding.id) \(resolved.binding.label)" } == ["a.tab1 Tab1"])
        #expect(a.problem == KeymapError.noLabel("new").message)
        #expect(throws: KeymapError.notAHost("app")) { try unnamed.get() }
        #expect(throws: KeymapError.noLabel("go")) { try blank.get() }
    }

    @Test("a host's key registered again by its name takes the place of the one before")
    func registeredAgain() throws {
        // Given
        let sut = try fixture.deckit()
        _ = try register(sut, "find", "mod+f")

        // When
        let keymap = try register(sut, "find", "mod+shift+f")

        // Then
        #expect(keymap.bindings.map { resolved in "\(resolved.binding.id) \(resolved.binding.keystroke?.spec ?? "")" } == ["@app.find shift+cmd+f"])
    }

    // MARK: - Private
    // A key as a run contributes it.
    private func key(_ name: String, _ spec: String, scope: KeyScope = .local) -> JSONValue {
        .object(
            [
                "name": .string(name),
                "label": .string(name.capitalized),
                "key": .string(spec),
                "scope": .string(scope.rawValue)
            ]
        )
    }

    // A key as the app registers it.
    private func register(
        _ sut: Deckit,
        _ name: String,
        _ spec: String,
        scope: KeyScope = .local
    ) throws -> ResolvedKeymap {
        try sut.keymap.register(Key(name: name, label: name.capitalized, spec: spec, scope: scope), provider: "@app", name: "App")
    }
}
