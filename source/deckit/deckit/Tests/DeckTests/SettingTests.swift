//
//  SettingTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("Setting")
struct SettingTests {
    // MARK: - Property
    private let root: URL
    private let home: URL
    private let source: URL

    // MARK: - Initializer
    init() {
        root = FileManager.default.temporaryDirectory.appending(path: "setting-tests-\(UUID().uuidString)")
        home = root.appending(path: "home")
        source = root.appending(path: "source")
    }

    // MARK: - Test
    @Test("a value set is saved among the mod's others")
    func valueIsSavedAmongOthers() throws {
        // Given
        let (sut, _, _) = try setting(["notes", "finder"])
        #expect(sut.keep([toggle("wrap"), number("size"), text("font")], mod: "notes", run: 1))
        _ = try sut.set(mod: "notes", key: "wrap", value: .bool(true), options: nil)
        _ = try sut.set(mod: "notes", key: "size", value: .number(14), options: nil)

        // When
        _ = try sut.set(mod: "notes", key: "font", value: .string("Menlo"), options: nil)

        // Then
        #expect(sut.read(mod: "notes") == ["wrap": .bool(true), "size": .number(14), "font": .string("Menlo")])
        #expect(sut.read(mod: "finder").isEmpty)
    }

    @Test("setting says what the value is now and whether that changed it")
    func setSaysWhetherChanged() throws {
        // Given
        let (sut, _, _) = try setting(["notes"])
        _ = sut.keep([number("size")], mod: "notes", run: 1)
        _ = try sut.set(mod: "notes", key: "size", value: .number(14), options: nil)

        // When
        let same = try sut.set(mod: "notes", key: "size", value: .number(14), options: nil)
        let changed = try sut.set(mod: "notes", key: "size", value: .number(15), options: nil)

        // Then
        #expect(same == SettingChange(value: .number(14), changed: false))
        #expect(changed == SettingChange(value: .number(15), changed: true))
    }

    @Test("the file holds the values as JSON, so what deck saved before reads the same")
    func fileIsJSON() throws {
        // Given
        let (sut, _, _) = try setting(["notes"])
        _ = sut.keep([number("size")], mod: "notes", run: 1)
        try Data(#"{"wrap":false,"size":12.5,"font":"Menlo"}"#.utf8).write(to: prepared("notes.json"))

        // When
        _ = try sut.set(mod: "notes", key: "size", value: .number(14), options: nil)

        // Then
        let text = try String(contentsOf: settings.appending(path: "notes.json"), encoding: .utf8)
        #expect(text == #"{"font":"Menlo","size":14,"wrap":false}"#)
    }

    @Test("a file that is not a table of values reads as none saved")
    func unreadableFileReadsAsNone() throws {
        // Given
        let (sut, _, _) = try setting(["notes"])
        try Data("[1,2]".utf8).write(to: prepared("notes.json"))

        // When
        let values = sut.read(mod: "notes")

        // Then
        #expect(values.isEmpty)
    }

    @Test("erasing takes the mod's values and no other's")
    func eraseTakesOnlyTheModsValues() throws {
        // Given
        let (sut, _, _) = try setting(["notes", "finder"])
        _ = sut.keep([toggle("wrap")], mod: "notes", run: 1)
        _ = sut.keep([toggle("wrap")], mod: "finder", run: 1)
        _ = try sut.set(mod: "notes", key: "wrap", value: .bool(true), options: nil)
        _ = try sut.set(mod: "finder", key: "wrap", value: .bool(false), options: nil)

        // When
        try sut.erase(mod: "notes")
        try sut.erase(mod: "never")

        // Then
        #expect(sut.read(mod: "notes").isEmpty)
        #expect(sut.read(mod: "finder") == ["wrap": .bool(false)])
    }

    @Test("only the mod's latest run declares, while it launches")
    func onlyTheLaunchingRunDeclares() throws {
        // Given
        let (sut, runner, _) = try setting(["notes", "finder"])

        // When
        let older = sut.keep([toggle("wrap")], mod: "notes", run: 0)
        let launching = sut.keep([toggle("wrap")], mod: "finder", run: 1)
        _ = try runner.started("finder", run: 1)
        let running = sut.keep([toggle("hidden")], mod: "finder", run: 1)
        let wrap = Result { try sut.set(mod: "notes", key: "wrap", value: .bool(true), options: nil) }
        let hidden = Result { try sut.set(mod: "finder", key: "hidden", value: .bool(true), options: nil) }

        // Then
        #expect(!older)
        #expect(launching)
        #expect(!running)
        #expect(throws: SettingError.undeclared(mod: "notes", key: "wrap")) { try wrap.get() }
        #expect(throws: SettingError.undeclared(mod: "finder", key: "hidden")) { try hidden.get() }
    }

    @Test("a declaration deck does not read is left out, and what is wrong with it answered, the rest kept")
    func unreadDeclarationIsAProblem() throws {
        // Given
        let (sut, _, _) = try setting(["notes"])
        let declared: [JSONValue] = [
            declaration(["key": .string("wrap"), "type": .string("toggle")]),
            declaration(["key": .string("shade"), "type": .string("slider")]),
            declaration(["key": .string("font"), "type": .string("text"), "label": .number(1)])
        ]

        // When
        let problems = sut.declare(declared, mod: "notes", run: 1)
        let wrap = Result { try sut.set(mod: "notes", key: "wrap", value: .bool(true), options: nil) }

        // Then
        #expect(throws: Never.self) { try wrap.get() }
        #expect(problems == [
            #"setting "shade": deck does not read its type"#,
            #"setting "font": deck does not read its label"#
        ])
    }

    @Test("a value is set as its declaration takes it, and a number within its bounds")
    func valueIsSetAsDeclared() throws {
        // Given
        let (sut, _, _) = try setting(["notes"])
        let choice = SettingDeclaration(key: "theme", type: .choice, options: [option("light"), option("dark")])
        let run = SettingDeclaration(key: "rebuild", type: .action, button: "Rebuild")
        _ = sut.keep([toggle("wrap"), number("size"), text("font"), choice, run], mod: "notes", run: 1)

        // When
        let size = try sut.set(mod: "notes", key: "size", value: .number(99), options: nil)
        let theme = try sut.set(mod: "notes", key: "theme", value: .string("dark"), options: nil)

        // Then
        #expect(size.value == .number(32))
        #expect(theme.value == .string("dark"))
    }

    @Test(
        "a value its declaration does not take is refused",
        arguments: [
            ("wrap", SettingValue?.some(.number(1)), SettingError.notOfType(key: "wrap", type: .toggle)),
            ("size", .string("12"), .notOfType(key: "size", type: .number)),
            ("font", nil, .notOfType(key: "font", type: .text)),
            ("theme", .string("blue"), .notAnOption(key: "theme", value: .string("blue"))),
            ("rebuild", .bool(true), .isAnAction("rebuild"))
        ]
    )
    func valueOutsideItsDeclarationIsRefused(key: String, value: SettingValue?, refusal: SettingError) throws {
        // Given
        let (sut, _, _) = try setting(["notes"])
        let choice = SettingDeclaration(key: "theme", type: .choice, options: [option("light"), option("dark")])
        let run = SettingDeclaration(key: "rebuild", type: .action, button: "Rebuild")
        _ = sut.keep([toggle("wrap"), number("size"), text("font"), choice, run], mod: "notes", run: 1)

        // When
        let set = Result { try sut.set(mod: "notes", key: key, value: value, options: nil) }

        // Then
        #expect(throws: refusal) { try set.get() }
    }

    @Test("a choice whose options are computed takes what its page worked out")
    func computedChoiceTakesWorkedOutOptions() throws {
        // Given
        let (sut, _, _) = try setting(["notes", "finder"])
        let font = SettingDeclaration(key: "font", type: .choice, computed: true)
        _ = sut.keep([font, toggle("wrap")], mod: "notes", run: 1)
        _ = sut.keep([SettingDeclaration(key: "icon", type: .choice, computed: true)], mod: "finder", run: 1)

        // When
        let set = try sut.set(mod: "notes", key: "font", value: .string("Menlo"), options: [option("Menlo")])
        let unoffered = Result { try sut.set(mod: "notes", key: "font", value: .string("Menlo"), options: nil) }

        // Then
        #expect(set.value == .string("Menlo"))
        #expect(sut.computedChoices(mod: "notes") == [SettingKey(mod: "notes", key: "font")])
        #expect(
            sut.computedChoices(mod: nil)
                == [SettingKey(mod: "finder", key: "icon"), SettingKey(mod: "notes", key: "font")]
        )
        #expect(throws: SettingError.notAnOption(key: "font", value: .string("Menlo"))) { try unoffered.get() }
    }

    @Test("the list has every loading mod's that declared any, in the catalog's order, values over defaults")
    func listHasDeclaredSettings() throws {
        // Given
        let (sut, _, _) = try setting(["notes", "finder", "editor"])
        let theme = SettingDeclaration(key: "theme", type: .choice, defaultValue: .string("light"), computed: true)
        let size = SettingDeclaration(key: "size", type: .number, defaultValue: .number(12))
        let run = SettingDeclaration(key: "rebuild", type: .action, button: "Rebuild")
        _ = sut.keep([theme, size, run], mod: "notes", run: 1)
        _ = sut.keep([], mod: "finder", run: 1)
        _ = sut.keep([toggle("wrap")], mod: "editor", run: 1)
        try Data(#"{"size":14,"gone":true}"#.utf8).write(to: prepared("notes.json"))

        // When
        let groups = sut.list(choices: [ComputedChoice(mod: "notes", key: "theme", options: [option("dark")])])

        // Then
        #expect(groups.map(\.id) == ["editor", "notes"])
        let items = try #require(groups.last?.items)
        #expect(items.map(\.declaration.key) == ["theme", "size", "rebuild"])
        #expect(items.map(\.value) == [.string("light"), .number(14), nil])
        let absent = SettingOption(value: .string("light"), label: "light", absent: true)
        #expect(items[0].options == [option("dark"), absent])
        #expect(items[1].options.isEmpty)
    }

    @Test("what a mod that no longer loads declared is forgotten")
    func forgetTakesWhatNoLongerLoads() throws {
        // Given
        let (sut, _, catalog) = try setting(["notes", "finder"])
        _ = sut.keep([toggle("wrap")], mod: "notes", run: 1)
        _ = sut.keep([toggle("wrap")], mod: "finder", run: 1)
        try FileManager.default.removeItem(at: source.appending(path: "notes"))

        // When
        _ = catalog.read()
        sut.forget()
        let wrap = Result { try sut.set(mod: "notes", key: "wrap", value: .bool(true), options: nil) }

        // Then
        #expect(sut.list(choices: []).map(\.id) == ["finder"])
        #expect(throws: SettingError.undeclared(mod: "notes", key: "wrap")) { try wrap.get() }
    }

    @Test("an action is run only for a key declared as one")
    func actionIsOnlyForAnAction() throws {
        // Given
        let (sut, _, _) = try setting(["notes"])
        _ = sut.keep([toggle("wrap"), SettingDeclaration(key: "rebuild", type: .action)], mod: "notes", run: 1)

        // When
        try sut.action(mod: "notes", key: "rebuild")
        let wrap = Result { try sut.action(mod: "notes", key: "wrap") }
        let never = Result { try sut.action(mod: "notes", key: "never") }

        // Then
        #expect(throws: SettingError.notAnAction(mod: "notes", key: "wrap")) { try wrap.get() }
        #expect(throws: SettingError.undeclared(mod: "notes", key: "never")) { try never.get() }
    }

    @Test("a declaration reads as the page tells it")
    func declarationIsJSON() throws {
        // Given
        let text = #"[{"key":"size","type":"number","label":"Size","default":12,"min":8,"options":[],"#
            + #""computed":false}]"#

        // When
        let sut = try JSONDecoder().decode([SettingDeclaration].self, from: Data(text.utf8))

        // Then
        let size = SettingDeclaration(key: "size", type: .number, label: "Size", defaultValue: .number(12), min: 8)
        #expect(sut == [size])
    }

    // MARK: - Private
    private var settings: URL {
        home.appending(path: "settings")
    }

    // Each mod read in place, launching its first run.
    private func setting(_ ids: [String]) throws -> (Setting, Runner, Catalog) {
        for id in ids {
            try write(id)
        }
        let store = Store()
        let reader = try ManifestReader(api: try #require(Version("1.0.0")), permissions: [], fields: [], store: store)
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        let catalog = Catalog(
            folder: folder,
            sources: [source],
            ship: [],
            modFolder: modFolder,
            dataFolder: DataFolder(folder: home.appending(path: "data"), store: store),
            installer: Installer(home: home, folder: folder, ship: [], modFolder: modFolder, store: store),
            loadOrder: LoadOrder(file: home.appending(path: "deck.json"), store: store),
            store: store
        )
        let runner = Runner(catalog: catalog)
        _ = catalog.read()
        _ = try runner.reconcile()

        return (Setting(folder: settings, store: store, catalog: catalog, runner: runner), runner, catalog)
    }

    private func write(_ id: String) throws {
        let location = source.appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let text = """
            id = "\(id)"
            version = "1.0.0"
            api = "1.0.0"
            main = "main.js"
            """
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        try Data().write(to: location.appending(path: "main.js"))
    }

    private func prepared(_ name: String) throws -> URL {
        try FileManager.default.createDirectory(at: settings, withIntermediateDirectories: true)
        return settings.appending(path: name)
    }

    // A declaration as a page sends it, with `fields` over what it always has.
    private func declaration(_ fields: [String: JSONValue]) -> JSONValue {
        .object(["options": .array([]), "computed": .bool(false)].merging(fields) { _, field in field })
    }

    private func toggle(_ key: String) -> SettingDeclaration {
        SettingDeclaration(key: key, type: .toggle)
    }

    private func number(_ key: String) -> SettingDeclaration {
        SettingDeclaration(key: key, type: .number, min: 8, max: 32)
    }

    private func text(_ key: String) -> SettingDeclaration {
        SettingDeclaration(key: key, type: .text)
    }

    private func option(_ value: String) -> SettingOption {
        SettingOption(value: .string(value), label: value)
    }
}
