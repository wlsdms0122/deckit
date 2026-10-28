//
//  ServerTests.swift
//  DeckitServerTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit
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
        initializeParams = #"{"home":"\#(home)","name":"Deckit","schemeHandlers":{},"api":"1.0.0","ship":[],"sources":["\#(home)source"],"permissions":[],"given":[]}"#
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

    @Test("configuration set as declared is read back as the JSON it was set as")
    func configurationRoundTrips() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("notes")
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/load","params":{"mods":["notes"]}}"#, to: sut)
        let declared = #"[{"key":"wrap","type":"boolean"},{"key":"size","type":"number","maximum":12}]"#
        _ = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"configuration/declare","#
                + #""params":{"mod":"notes","run":1,"configuration":\#(declared)}}"#,
            to: sut
        )
        _ = try send(
            #"{"jsonrpc":"2.0","id":5,"method":"configuration/set","params":{"mod":"notes","key":"wrap","value":true}}"#,
            to: sut
        )

        // When
        let set = try send(
            #"{"jsonrpc":"2.0","id":6,"method":"configuration/set","params":{"mod":"notes","key":"size","value":14}}"#,
            to: sut
        )
        let response = try send(
            #"{"jsonrpc":"2.0","id":7,"method":"configuration/values","params":{"mod":"notes"}}"#,
            to: sut
        )

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
        let permission = #"{"id":"deckit.mods","name":"Mods","means":"All of them."}"#

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)","name":"Deckit","schemeHandlers":{},"api":"1.0.0","ship":[],"sources":[],"permissions":[\#(permission),\#(permission)],"given":[]}}"#,
            to: sut
        )

        // Then
        #expect(
            response == (try json(#"{"jsonrpc":"2.0","id":1,"error":{"code":-32803,"message":"the permission deckit.mods is defined twice","data":{"kind":"PERMISSION"}}}"#))
        )
    }

    @Test("the catalog reads a mod's urls as deckit judges them")
    func catalogReadsURLs() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("opener", urls: #"["https:*", "https:*"]"#)
        try mod("broken", urls: #"["https:*", "*"]"#)

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)

        // Then
        guard case let .object(fields) = response, case let .array(mods)? = fields["result"] else {
            Issue.record("no mods in \(response)")
            return
        }
        let opener = mods.first { mod in value(in: mod, at: "manifest", "id") == .string("opener") }
        let broken = mods.first { mod in value(in: mod, at: "manifest", "id") == .string("broken") }
        #expect(opener.flatMap { mod in value(in: mod, at: "manifest", "urls") } == .array([.string("https:*")]))
        #expect(opener.flatMap { mod in value(in: mod, at: "problem") } == nil)
        #expect(
            broken.flatMap { mod in value(in: mod, at: "problem") }
                == .string(#"urls: "*" already takes every address, so it stands alone"#)
        )
    }

    @Test("what a run contributed comes back with it, the layers' too, and a mod that depends on it connects to its exports")
    func contributionsRoundTrip() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("calendar")
        try mod("google", dependencies: #"calendar = "1.0.0""#)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/load","params":{"mods":["calendar"]}}"#, to: sut)
        let begin = #"{"jsonrpc":"2.0","id":4,"method":"connection/begin","params":"#
        _ = try send(begin + #"{"mod":"calendar","run":1,"lifecycle":0}}"#, to: sut)
        let contributions = #"{"exportedIn":0,"awaits":{},"pins":["a"]}"#
        let started = #"{"mod":"calendar","run":1,"summary":{"view":true},"contributions":\#(contributions)}"#

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":5,"method":"runner/started","params":\#(started)}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":6,"method":"runner/load","params":{"mods":["google"]}}"#, to: sut)
        let connected = try send(begin + #"{"mod":"google","run":1,"lifecycle":0}}"#, to: sut)

        // Then
        guard case let .array(effects)? = value(in: response, at: "result"), let told = effects.first else {
            Issue.record("no effects in \(response)")
            return
        }
        #expect(value(in: told, at: "notification") == .string("didLaunch"))
        #expect(value(in: told, at: "summary", "view") == .bool(true))
        #expect(value(in: told, at: "contributions", "pins") == .array([.string("a")]))
        #expect(value(in: told, at: "contributions", "exportedIn") == .number(0))
        #expect(
            value(in: connected, at: "result")
                == (try json(
                    #"[{"id":1,"dependent":{"mod":"google","run":1,"lifecycle":0},"#
                        + #""dependency":{"mod":"calendar","run":1,"lifecycle":0},"required":true}]"#
                ))
        )
    }

    @Test("a configuration declared that deckit does not read is a problem of the run as it is declared")
    func unreadConfigurationIsAProblem() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("notes")
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/load","params":{"mods":["notes"]}}"#, to: sut)
        let declared = #"[{"key":"shade","type":"slider"}]"#

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"configuration/declare","#
                + #""params":{"mod":"notes","run":1,"configuration":\#(declared)}}"#,
            to: sut
        )

        // Then
        guard case let .array(effects)? = value(in: response, at: "result") else {
            Issue.record("no effects in \(response)")
            return
        }
        #expect(effects.contains { effect in
            value(in: effect, at: "problem") == .string(#"configuration "shade": deckit does not read its type"#)
        })
    }

    @Test("deckit's own methods answer through the server, as deck's do")
    func deckitMethodsAnswer() throws {
        // Given
        try mod("mail", urls: #"["mailto:*"]"#)
        _ = try send(initializeRequest, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/load","params":{"mods":["mail"]}}"#, to: sut)
        let contributions = #"{"awaits":{},"urls":true,"commands":[{"name":"compose"}]}"#
        _ = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"runner/started","params":{"mod":"mail","run":1,"summary":{},"#
                + #""contributions":\#(contributions)}}"#,
            to: sut
        )

        // When
        let defined = try send(
            #"{"jsonrpc":"2.0","id":5,"method":"command/define","params":{"provider":"@app","#
                + #""commands":[{"name":"go"}]}}"#,
            to: sut
        )
        let registered = try send(
            #"{"jsonrpc":"2.0","id":5,"method":"keymap/register","params":{"provider":"@app","key":{"name":"go","#
                + #""label":"Go","key":"mod+1","scope":"local"}}}"#,
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
            #"{"jsonrpc":"2.0","id":8,"method":"open/route","params":{"url":"mailto:a@b.c","opensFiles":true,"#
                + #""usesDefaultApp":false}}"#,
            to: sut
        )
        let listed = try send(#"{"jsonrpc":"2.0","id":9,"method":"command/list"}"#, to: sut)
        let checked = try send(
            #"{"jsonrpc":"2.0","id":10,"method":"command/check","params":{"provider":"mail","command":"compose"}}"#,
            to: sut
        )
        let provider = try send(
            #"{"jsonrpc":"2.0","id":11,"method":"provider","params":{"id":"@app"}}"#,
            to: sut
        )
        let nobody = try send(#"{"jsonrpc":"2.0","id":12,"method":"provider","params":{"id":"post"}}"#, to: sut)

        // Then
        guard case let .array(bindings)? = value(in: bound, at: "result", "bindings"), let go = bindings.first else {
            Issue.record("no bindings in \(bound)")
            return
        }
        #expect(value(in: defined, at: "result") == .bool(true))
        #expect(value(in: registered, at: "result", "revision") != nil)
        #expect(value(in: go, at: "id") == .string("@app.go"))
        #expect(value(in: go, at: "spec") == .string("cmd+2"))
        #expect(value(in: set, at: "result") == .bool(true))
        #expect(value(in: routed, at: "result", "handlers") == .array([.string("mail")]))
        #expect(listed == (try json(
            #"{"jsonrpc":"2.0","id":9,"result":[{"provider":"@app","command":"go","description":"","params":null},"#
                + #"{"provider":"mail","command":"compose","description":"","params":null}]}"#
        )))
        #expect(value(in: checked, at: "result", "command") == .string("compose"))
        #expect(value(in: provider, at: "result") == .object([
            "id": .string("@app"), "name": .string("Deckit"), "host": .bool(true),
        ]))
        #expect(value(in: nobody, at: "result") == .null)
    }

    @Test("a configuration lists with the declaration's fields, `default` as declared, and the value it reads as")
    func configurationItemIsJSON() throws {
        // Given
        let size = ConfigurationDeclaration(
            key: "size",
            type: .number,
            title: "Size",
            defaultValue: .number(12),
            minimum: 8
        )
        let sut = ConfigurationItem(declaration: size, value: .number(14))
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys

        // When
        let listed = String(decoding: try encoder.encode(sut), as: UTF8.self)

        // Then
        #expect(listed == #"{"default":12,"key":"size","minimum":8,"oneOf":[],"title":"Size","type":"number","value":14}"#)
    }

    @Test("the keymap reads as the driver keeps it: each binding with its chord, its issues and its keystroke")
    func keymapIsJSON() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        for (id, (name, spec)) in [("one", "mod+1"), ("two", "mod+2")].enumerated() {
            _ = try send(
                #"{"jsonrpc":"2.0","id":\#(id + 2),"method":"keymap/register","params":{"provider":"@app","#
                    + #""key":{"name":"\#(name)","label":"\#(name)","key":"\#(spec)","scope":"local"}}}"#,
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
        #expect(value(in: held, at: "kind") == .string("held"))
        #expect(value(in: held, at: "other", "id") == .string("@app.one"))
        #expect(value(in: held, at: "other", "provider") == .string("@app"))
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
    private func mod(_ id: String, urls: String? = nil, dependencies: String? = nil) throws {
        let folder = URL(filePath: home + "source").appending(path: id)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let manifest = """
            id = "\(id)"
            version = "1.0.0"
            api = "1.0.0"
            main = "main.js"
            """ + (urls.map { urls in "\nurls = \(urls)" } ?? "")
            + (dependencies.map { dependencies in "\n[dependencies]\n\(dependencies)" } ?? "")
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
