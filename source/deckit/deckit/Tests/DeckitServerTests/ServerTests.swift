//
//  ServerTests.swift
//  DeckitServerTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
import Deckit
@testable import DeckitServer

@Suite("Server")
struct ServerTests {
    // MARK: - Property
    private let home: String
    private let initializeParams: String
    private let initializeRequest: String
    private let sut: Server

    // MARK: - Initializer
    init() {
        home = FileManager.default.temporaryDirectory.appending(path: "server-tests-\(UUID().uuidString)").path()
        initializeParams = #"{"home":"\#(home)","name":"Deckit","schemeHandlers":{},"api":"1.0.0","ship":[],"sources":["\#(home)source"],"permissions":[]}"#
        initializeRequest = #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":\#(initializeParams)}"#
        sut = Server()
    }

    // MARK: - Test
    @Test("initialize answers where deck keeps the mods it installed and their data folders")
    func initializeAnswersFolders() throws {
        // Given
        // When
        let response = try send(initializeRequest, to: sut)

        // Then
        #expect(value(in: response, at: "result", "mods") == .string(home + "/mods"))
        #expect(value(in: response, at: "result", "data") == .string(home + "/data"))
    }

    @Test("a call before initialize is refused")
    func callBeforeInitializeIsRefused() throws {
        // Given
        // When
        let response = try send(#"{"jsonrpc":"2.0","id":1,"method":"record/keys","params":{"mod":"notes"}}"#, to: sut)

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":1,"error":{"code":-32002,"message":"record/keys before initialize"}}"#)))
    }

    @Test("initialize twice is refused")
    func secondInitializeIsRefused() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"initialize","params":\#(initializeParams)}"#,
            to: sut
        )

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"error":{"code":-32600,"message":"the core is initialized once"}}"#)))
    }

    @Test("a record written is read back as its text")
    func recordRoundTrips() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        _ = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"record/write","params":{"mod":"notes","key":"tabs","text":"[1,\"a\"]"}}"#,
            to: sut
        )

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":3,"method":"record/read","params":{"mod":"notes","key":"tabs"}}"#,
            to: sut
        )

        // Then
        #expect(response == .object(["jsonrpc": .string("2.0"), "id": .number(3), "result": .string(#"[1,"a"]"#)]))
    }

    @Test("a record never written is read as null")
    func missingRecordIsNull() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"record/read","params":{"mod":"notes","key":"tabs"}}"#,
            to: sut
        )

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"result":null}"#)))
    }

    @Test("a refusal carries its kind")
    func refusalCarriesItsKind() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"record/read","params":{"mod":"notes","key":"A"}}"#,
            to: sut
        )

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"error":{"code":-32803,"message":"not a record key: A","data":{"kind":"KEY"}}}"#)))
    }

    @Test("an unknown method is not found")
    func unknownMethodIsNotFound() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":2,"method":"record/burn","params":{}}"#, to: sut)

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"no method record/burn"}}"#)))
    }

    @Test("params of the wrong shape are invalid")
    func wrongParamsAreInvalid() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":2,"method":"record/keys","params":{"key":"a"}}"#, to: sut)

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"error":{"code":-32602,"message":"record/keys has no such params at mod"}}"#)))
    }

    @Test("params of the wrong shape say where")
    func wrongParamsSayWhere() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"keymap/keystrokes","params":{"specs":["mod+k",5]}}"#,
            to: sut
        )

        // Then
        #expect(value(in: response, at: "error", "message") == .string("keymap/keystrokes has no such params at specs.1"))
    }

    @Test("a notification is not answered")
    func notificationIsNotAnswered() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = sut.respond(to: Data(#"{"jsonrpc":"2.0","method":"record/keys","params":{"mod":"notes"}}"#.utf8))

        // Then
        #expect(response == nil)
    }

    @Test("a line that is no request is a parse error with no id")
    func unreadableLineIsParseError() throws {
        // Given
        // When
        let response = try send("not json", to: sut)

        // Then
        guard case let .object(fields) = response, case let .object(error)? = fields["error"] else {
            Issue.record("no error in \(response)")
            return
        }
        #expect(fields["id"] == .null)
        #expect(error["code"] == .number(-32700))
    }

    @Test("JSON that is no request is an invalid request")
    func shapelessMessageIsInvalidRequest() throws {
        // Given
        // When
        let response = try send(#"{"jsonrpc":"2.0","id":"one"}"#, to: sut)

        // Then
        guard case let .object(fields) = response, case let .object(error)? = fields["error"] else {
            Issue.record("no error in \(response)")
            return
        }
        #expect(error["code"] == .number(-32600))
    }

    @Test("settings set as declared are read back as the JSON they were set as")
    func settingsRoundTrip() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("notes")
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/reconcile"}"#, to: sut)
        let settings = #"[{"key":"wrap","type":"toggle","options":[],"computed":false},"#
            + #"{"key":"size","type":"number","max":12,"options":[],"computed":false}]"#
        _ = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"setting/declare","params":{"mod":"notes","run":1,"settings":\#(settings)}}"#,
            to: sut
        )
        _ = try send(
            #"{"jsonrpc":"2.0","id":5,"method":"setting/set","params":{"mod":"notes","key":"wrap","value":true}}"#,
            to: sut
        )

        // When
        let set = try send(
            #"{"jsonrpc":"2.0","id":6,"method":"setting/set","params":{"mod":"notes","key":"size","value":14}}"#,
            to: sut
        )
        let response = try send(#"{"jsonrpc":"2.0","id":7,"method":"setting/read","params":{"mod":"notes"}}"#, to: sut)

        // Then
        #expect(set == (try json(#"{"jsonrpc":"2.0","id":6,"result":{"value":12,"changed":true}}"#)))
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":7,"result":{"wrap":true,"size":12}}"#)))
    }

    @Test("state written is read back by all, with no params asked")
    func stateRoundTrips() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        _ = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"state/write","params":{"folder":"host","key":"pinned","text":"[]"}}"#,
            to: sut
        )

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":3,"method":"state/all"}"#, to: sut)

        // Then
        #expect(
            response == (try json(#"{"jsonrpc":"2.0","id":3,"result":[{"folder":"host","key":"pinned","text":"[]"}]}"#))
        )
    }

    @Test("initialize refuses a permission defined twice")
    func initializeRefusesPermissionDefinedTwice() throws {
        // Given
        let permission = #"{"id":"deckit.mods","name":"Mods","means":"All of them.","reach":"app"}"#

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)","name":"Deckit","schemeHandlers":{},"api":"1.0.0","ship":[],"sources":[],"permissions":[\#(permission),\#(permission)]}}"#,
            to: sut
        )

        // Then
        #expect(
            response == (try json(#"{"jsonrpc":"2.0","id":1,"error":{"code":-32803,"message":"the permission deckit.mods is defined twice","data":{"kind":"PERMISSION"}}}"#))
        )
    }

    @Test("the catalog reads a mod's url-schemes as deckit judges them")
    func catalogReadsURLSchemes() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("opener", schemes: #"["https", "https"]"#)
        try mod("broken", schemes: #"["https", "*"]"#)

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)

        // Then
        guard case let .object(fields) = response, case let .array(mods)? = fields["result"] else {
            Issue.record("no mods in \(response)")
            return
        }
        let opener = mods.first { mod in value(in: mod, at: "manifest", "id") == .string("opener") }
        let broken = mods.first { mod in value(in: mod, at: "manifest", "id") == .string("broken") }
        #expect(opener.flatMap { mod in value(in: mod, at: "manifest", "urlSchemes") } == .array([.string("https")]))
        #expect(opener.flatMap { mod in value(in: mod, at: "problem") } == nil)
        #expect(
            broken.flatMap { mod in value(in: mod, at: "problem") }
                == .string(#"url-schemes: "*" already takes every scheme, so it stands alone"#)
        )
    }

    @Test("what a run contributed comes back with it, the layers' too, and is what the mods that require it are given")
    func contributionsRoundTrip() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("calendar")
        try mod("google", requires: #"calendar = "1.0.0""#)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/reconcile"}"#, to: sut)
        let contributions = #"{"exports":{"values":"{\"name\":\"Calendar\"}","functions":[["ask"]]},"#
            + #""extensionPoints":["accounts"],"extensions":{},"styles":["a.css"]}"#
        let started = #"{"mod":"calendar","run":1,"summary":{"view":true},"contributions":\#(contributions)}"#

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":4,"method":"runner/started","params":\#(started)}"#, to: sut)
        let dependencies = try send(
            #"{"jsonrpc":"2.0","id":5,"method":"export/dependencies","params":{"mod":"google","run":1}}"#,
            to: sut
        )

        // Then
        guard case let .array(effects)? = value(in: response, at: "result"), let told = effects.first else {
            Issue.record("no effects in \(response)")
            return
        }
        #expect(value(in: told, at: "notification") == .string("didLaunch"))
        #expect(value(in: told, at: "summary", "view") == .bool(true))
        #expect(value(in: told, at: "contributions", "styles") == .array([.string("a.css")]))
        #expect(value(in: told, at: "contributions", "extensionPoints") == .array([.string("accounts")]))
        #expect(
            value(in: dependencies, at: "result", "ready", "requires", "calendar")
                == (try json(#"{"values":"{\"name\":\"Calendar\"}","functions":[["ask"]]}"#))
        )
    }

    @Test("a setting declared that deck does not read is a problem of the run as it is declared")
    func unreadSettingIsAProblem() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("notes")
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/reconcile"}"#, to: sut)
        let settings = #"[{"key":"shade","type":"slider","options":[],"computed":false}]"#

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"setting/declare","params":{"mod":"notes","run":1,"settings":\#(settings)}}"#,
            to: sut
        )

        // Then
        guard case let .array(effects)? = value(in: response, at: "result") else {
            Issue.record("no effects in \(response)")
            return
        }
        #expect(effects.contains { effect in
            value(in: effect, at: "problem") == .string(#"setting "shade": deck does not read its type"#)
        })
    }

    @Test("deckit's own methods answer through the server, as deck's do")
    func deckitMethodsAnswer() throws {
        // Given
        try mod("mail", schemes: #"["mailto"]"#)
        _ = try send(initializeRequest, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/reconcile"}"#, to: sut)
        let contributions = #"{"exports":{"values":"{}","functions":[]},"extensionPoints":[],"extensions":{},"#
            + #""handleURL":true,"commands":true}"#
        _ = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"runner/started","params":{"mod":"mail","run":1,"summary":{},"#
                + #""contributions":\#(contributions)}}"#,
            to: sut
        )

        // When
        let registered = try send(
            #"{"jsonrpc":"2.0","id":5,"method":"keymap/register","params":{"action":"go","key":"mod+1","label":"Go","#
                + #""global":false}}"#,
            to: sut
        )
        let bound = try send(
            #"{"jsonrpc":"2.0","id":6,"method":"keymap/bind","params":{"id":"@app.go","spec":"cmd+2"}}"#,
            to: sut
        )
        let set = try send(
            #"{"jsonrpc":"2.0","id":7,"method":"open/setHandlers","params":{"scheme":"mailto","order":["mail"],"#
                + #""off":[]}}"#,
            to: sut
        )
        let routed = try send(
            #"{"jsonrpc":"2.0","id":8,"method":"open/route","params":{"url":"mailto:a@b.c","userInitiated":true,"#
                + #""usesDefaultApp":false}}"#,
            to: sut
        )
        let sources = try send(#"{"jsonrpc":"2.0","id":9,"method":"command/sources"}"#, to: sut)

        // Then
        guard case let .array(bindings)? = value(in: bound, at: "result", "bindings"), let go = bindings.first else {
            Issue.record("no bindings in \(bound)")
            return
        }
        #expect(value(in: registered, at: "result", "revision") != nil)
        #expect(value(in: go, at: "id") == .string("@app.go"))
        #expect(value(in: go, at: "spec") == .string("cmd+2"))
        #expect(value(in: set, at: "result") == .bool(true))
        #expect(value(in: routed, at: "result", "handlers") == .array([.string("mail")]))
        #expect(sources == (try json(
            #"{"jsonrpc":"2.0","id":9,"result":[{"id":"mail","name":"mail","commands":true,"now":false,"#
                + #""resolve":false}]}"#
        )))
    }

    @Test("a setting lists as Settings reads it: the declaration's fields, `default` as declared, value and options")
    func settingItemIsJSON() throws {
        // Given
        let size = SettingDeclaration(key: "size", type: .number, label: "Size", defaultValue: .number(12), min: 8)
        let sut = SettingItem(declaration: size, value: .number(14), options: [])
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys

        // When
        let listed = String(decoding: try encoder.encode(sut), as: UTF8.self)

        // Then
        #expect(
            listed == #"{"computed":false,"default":12,"key":"size","label":"Size","min":8,"options":[],"#
                + #""type":"number","value":14}"#
        )
    }

    @Test("options a page answered that are not options read as none")
    func unreadableOptionsReadAsNone() throws {
        // Given
        let text = #"[{"mod":"notes","key":"font","options":[{"value":null}]},{"mod":"notes","key":"size"}]"#

        // When
        let sut = try JSONDecoder().decode([ComputedChoice].self, from: Data(text.utf8))

        // Then
        #expect(sut.map(\.key) == ["font", "size"])
        #expect(sut.allSatisfy { choice in choice.options.isEmpty })
    }

    @Test("the keymap reads as the driver keeps it: each binding with its chord, its issues and its keystroke")
    func keymapIsJSON() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        for (id, (action, spec)) in [("one", "mod+1"), ("two", "mod+2")].enumerated() {
            _ = try send(
                #"{"jsonrpc":"2.0","id":\#(id + 2),"method":"keymap/register","params":{"action":"\#(action)","#
                    + #""key":"\#(spec)","label":"","global":false}}"#,
                to: sut
            )
        }

        // When
        let bound = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"keymap/bind","params":{"id":"@app.two","spec":"cmd+1"}}"#,
                to: sut
        )

        // Then
        guard case let .array(bindings)? = value(in: bound, at: "result", "bindings"), let two = bindings.last,
            case let .array(issues)? = value(in: two, at: "issues"), let held = issues.first
        else {
            Issue.record("not a keymap: \(bound)")
            return
        }
        #expect(value(in: bound, at: "result", "revision") == .number(3))
        #expect(value(in: two, at: "id") == .string("@app.two"))
        #expect(value(in: two, at: "key") == Keystroke(spec: "mod+2")?.spec.map(JSONValue.string))
        #expect(value(in: two, at: "spec") == .string("cmd+1"))
        #expect(value(in: two, at: "chord") == .string(try #require(Keystroke(spec: "cmd+1")).label))
        #expect(value(in: two, at: "changed") == .bool(true))
        #expect(value(in: two, at: "active") == .bool(false))
        #expect(value(in: two, at: "keystroke", "code") == .string("Digit1"))
        #expect(value(in: held, at: "level") == .string("error"))
        #expect(value(in: held, at: "kind") == .string("held"))
        #expect(value(in: held, at: "other", "id") == .string("@app.one"))
        #expect(value(in: held, at: "other", "ownerName") == .string("Deckit"))
        #expect(value(in: held, at: "other", "app") == .bool(true))
    }

    @Test("a result that cannot be written is answered with an internal error, never dropped")
    func unwritableResultIsAnswered() throws {
        // Given
        struct Unwritable: Encodable, Sendable {
            func encode(to encoder: any Encoder) throws {
                throw EncodingError.invalidValue(0, EncodingError.Context(codingPath: [], debugDescription: "none"))
            }
        }

        // When
        let response = try json(String(decoding: sut.written(.result(id: 7, Unwritable())), as: UTF8.self))

        // Then
        #expect(value(in: response, at: "id") == .number(7))
        #expect(value(in: response, at: "error", "code") == .number(-32603))
    }

    @Test("a state key deckit keeps itself is refused to the driver")
    func reservedStateKeyIsRefused() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"state/write","params":{"folder":null,"key":"keys","text":"[]"}}"#,
            to: sut
        )

        // Then
        #expect(value(in: response, at: "error", "data", "kind") == .string("RESERVED"))
    }

    // MARK: - Private
    private func mod(_ id: String, schemes: String? = nil, requires: String? = nil) throws {
        let folder = URL(filePath: home + "source").appending(path: id)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let manifest = """
            id = "\(id)"
            version = "1.0.0"
            api = "1.0.0"
            main = "main.js"
            """ + (schemes.map { schemes in "\nurl-schemes = \(schemes)" } ?? "")
            + (requires.map { requires in "\n[requires]\n\(requires)" } ?? "")
        try Data(manifest.utf8).write(to: folder.appending(path: "manifest.toml"))
        try Data().write(to: folder.appending(path: "main.js"))
    }

    private func value(in json: JSONValue, at path: String...) -> JSONValue? {
        path.reduce(json as JSONValue?) { value, key in
            guard case let .object(fields)? = value else { return nil }
            return fields[key]
        }
    }

    private func send(_ message: String, to server: Server) throws -> JSONValue {
        try json(String(decoding: try #require(server.respond(to: Data(message.utf8))), as: UTF8.self))
    }

    private func json(_ text: String) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
    }
}
