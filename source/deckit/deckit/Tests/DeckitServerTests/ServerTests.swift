//
//  ServerTests.swift
//  DeckitServerTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
import Deck
@testable import DeckitServer

@Suite("Server")
struct ServerTests {
    // MARK: - Property
    private let home: String
    private let initializeParams: String
    private let sut: Server

    // MARK: - Initializer
    init() {
        home = FileManager.default.temporaryDirectory.appending(path: "server-tests-\(UUID().uuidString)").path()
        initializeParams = #"{"home":"\#(home)","name":"Deckit","schemeHandlers":{},"api":"1.0.0","ship":[],"sources":["\#(home)source"],"permissions":[]}"#
        sut = Server()
    }

    // MARK: - Test
    @Test("initialize answers an empty result")
    func testThatInitializeAnswers() throws {
        // Given
        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":\#(initializeParams)}"#)

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":1,"result":{}}"#)))
    }

    @Test("a call before initialize is refused")
    func testThatCallBeforeInitializeIsRefused() throws {
        // Given
        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":1,"method":"record/keys","params":{"mod":"notes"}}"#)

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":1,"error":{"code":-32002,"message":"record/keys before initialize"}}"#)))
    }

    @Test("initialize twice is refused")
    func testThatSecondInitializeIsRefused() throws {
        // Given
        try initialize()

        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":2,"method":"initialize","params":\#(initializeParams)}"#)

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"error":{"code":-32600,"message":"the core is initialized once"}}"#)))
    }

    @Test("a record written is read back as its text")
    func testThatRecordRoundTrips() throws {
        // Given
        try initialize()
        _ = try respond(
            #"{"jsonrpc":"2.0","id":2,"method":"record/write","params":{"mod":"notes","key":"tabs","text":"[1,\"a\"]"}}"#
        )

        // When
        let response = try respond(
            #"{"jsonrpc":"2.0","id":3,"method":"record/read","params":{"mod":"notes","key":"tabs"}}"#
        )

        // Then
        #expect(response == .object(["jsonrpc": .string("2.0"), "id": .number(3), "result": .string(#"[1,"a"]"#)]))
    }

    @Test("a record never written is read as null")
    func testThatMissingRecordIsNull() throws {
        // Given
        try initialize()

        // When
        let response = try respond(
            #"{"jsonrpc":"2.0","id":2,"method":"record/read","params":{"mod":"notes","key":"tabs"}}"#
        )

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"result":null}"#)))
    }

    @Test("a refusal carries its kind")
    func testThatRefusalCarriesItsKind() throws {
        // Given
        try initialize()

        // When
        let response = try respond(
            #"{"jsonrpc":"2.0","id":2,"method":"record/read","params":{"mod":"notes","key":"A"}}"#
        )

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"error":{"code":-32803,"message":"not a record key: A","data":{"kind":"KEY"}}}"#)))
    }

    @Test("an unknown method is not found")
    func testThatUnknownMethodIsNotFound() throws {
        // Given
        try initialize()

        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":2,"method":"record/burn","params":{}}"#)

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"no method record/burn"}}"#)))
    }

    @Test("params of the wrong shape are invalid")
    func testThatWrongParamsAreInvalid() throws {
        // Given
        try initialize()

        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":2,"method":"record/keys","params":{"key":"a"}}"#)

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"error":{"code":-32602,"message":"record/keys has no such params at mod"}}"#)))
    }

    @Test("params of the wrong shape say where")
    func testThatWrongParamsSayWhere() throws {
        // Given
        try initialize()
        let settings = #"[{"key":"wrap","type":"toggle","options":[],"computed":false},{"key":"size","type":"number","#
            + #""label":5,"options":[],"computed":false}]"#

        // When
        let response = try respond(
            #"{"jsonrpc":"2.0","id":2,"method":"setting/declare","params":{"mod":"notes","run":1,"settings":\#(settings)}}"#
        )

        // Then
        #expect(value(in: response, at: "error", "message") == .string("setting/declare has no such params at settings.1.label"))
    }

    @Test("a notification is not answered")
    func testThatNotificationIsNotAnswered() throws {
        // Given
        try initialize()

        // When
        let response = sut.respond(to: Data(#"{"jsonrpc":"2.0","method":"record/keys","params":{"mod":"notes"}}"#.utf8))

        // Then
        #expect(response == nil)
    }

    @Test("a line that is no request is a parse error with no id")
    func testThatUnreadableLineIsParseError() throws {
        // Given
        // When
        let response = try respond("not json")

        // Then
        guard case let .object(fields) = response, case let .object(error)? = fields["error"] else {
            Issue.record("no error in \(response)")
            return
        }
        #expect(fields["id"] == .null)
        #expect(error["code"] == .number(-32700))
    }

    @Test("JSON that is no request is an invalid request")
    func testThatShapelessMessageIsInvalidRequest() throws {
        // Given
        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":"one"}"#)

        // Then
        guard case let .object(fields) = response, case let .object(error)? = fields["error"] else {
            Issue.record("no error in \(response)")
            return
        }
        #expect(error["code"] == .number(-32600))
    }

    @Test("settings set as declared are read back as the JSON they were set as")
    func testThatSettingsRoundTrip() throws {
        // Given
        try initialize()
        try mod("notes")
        _ = try respond(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#)
        _ = try respond(#"{"jsonrpc":"2.0","id":3,"method":"runner/reconcile"}"#)
        let settings = #"[{"key":"wrap","type":"toggle","options":[],"computed":false},"#
            + #"{"key":"size","type":"number","max":12,"options":[],"computed":false}]"#
        _ = try respond(
            #"{"jsonrpc":"2.0","id":4,"method":"setting/declare","params":{"mod":"notes","run":1,"settings":\#(settings)}}"#
        )
        _ = try respond(
            #"{"jsonrpc":"2.0","id":5,"method":"setting/set","params":{"mod":"notes","key":"wrap","value":true}}"#
        )

        // When
        let set = try respond(
            #"{"jsonrpc":"2.0","id":6,"method":"setting/set","params":{"mod":"notes","key":"size","value":14}}"#
        )
        let response = try respond(#"{"jsonrpc":"2.0","id":7,"method":"setting/read","params":{"mod":"notes"}}"#)

        // Then
        #expect(set == (try json(#"{"jsonrpc":"2.0","id":6,"result":{"value":12,"changed":true}}"#)))
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":7,"result":{"wrap":true,"size":12}}"#)))
    }

    @Test("state written is read back by all, with no params asked")
    func testThatStateRoundTrips() throws {
        // Given
        try initialize()
        _ = try respond(
            #"{"jsonrpc":"2.0","id":2,"method":"state/write","params":{"folder":"host","key":"pinned","text":"[]"}}"#
        )

        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":3,"method":"state/all"}"#)

        // Then
        #expect(
            response == (try json(#"{"jsonrpc":"2.0","id":3,"result":[{"folder":"host","key":"pinned","text":"[]"}]}"#))
        )
    }

    @Test("initialize refuses a permission defined twice")
    func testThatInitializeRefusesPermissionDefinedTwice() throws {
        // Given
        let permission = #"{"id":"deckit.mods","name":"Mods","means":"All of them.","reach":"app"}"#

        // When
        let response = try respond(
            #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)","name":"Deckit","schemeHandlers":{},"api":"1.0.0","ship":[],"sources":[],"permissions":[\#(permission),\#(permission)]}}"#
        )

        // Then
        #expect(
            response == (try json(#"{"jsonrpc":"2.0","id":1,"error":{"code":-32803,"message":"the permission deckit.mods is defined twice","data":{"kind":"PERMISSION"}}}"#))
        )
    }

    @Test("the catalog reads a mod's url-schemes as deckit judges them")
    func testThatCatalogReadsURLSchemes() throws {
        // Given
        try initialize()
        try mod("opener", schemes: #"["https", "https"]"#)
        try mod("broken", schemes: #"["https", "*"]"#)

        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#)

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
    func testThatContributionsRoundTrip() throws {
        // Given
        try initialize()
        try mod("calendar")
        try mod("google", requires: #"calendar = "1.0.0""#)
        _ = try respond(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#)
        _ = try respond(#"{"jsonrpc":"2.0","id":3,"method":"runner/reconcile"}"#)
        let contributions = #"{"exports":{"values":"{\"name\":\"Calendar\"}","functions":[["ask"]]},"#
            + #""extensionPoints":["accounts"],"extensions":{},"styles":["a.css"]}"#
        let started = #"{"mod":"calendar","run":1,"summary":{"view":true},"contributions":\#(contributions)}"#

        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":4,"method":"runner/started","params":\#(started)}"#)
        let dependencies = try respond(
            #"{"jsonrpc":"2.0","id":5,"method":"export/dependencies","params":{"mod":"google","run":1}}"#
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

    private func initialize() throws {
        _ = try respond(#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":\#(initializeParams)}"#)
    }

    private func value(in json: JSONValue, at path: String...) -> JSONValue? {
        path.reduce(json as JSONValue?) { value, key in
            guard case let .object(fields)? = value else { return nil }
            return fields[key]
        }
    }

    private func respond(_ message: String) throws -> JSONValue {
        try json(String(decoding: try #require(sut.respond(to: Data(message.utf8))), as: UTF8.self))
    }

    private func json(_ text: String) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
    }
}
