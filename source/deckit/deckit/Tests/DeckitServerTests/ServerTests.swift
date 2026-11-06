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
        initializeParams = #"{"home":"\#(home)","implementations":{},"api":"1.0.0","ship":[],"#
            + #""sources":["\#(home)source"],"permissions":[]}"#
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
        #expect(
            response == (try json(
                #"{"jsonrpc":"2.0","id":1,"error":{"code":-32002,"message":"record/keys before initialize"}}"#
            ))
        )
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
        #expect(
            response == (try json(
                #"{"jsonrpc":"2.0","id":2,"error":{"code":-32600,"message":"the core is initialized once"}}"#
            ))
        )
    }

    @Test("a record written is read back as its text")
    func recordRoundTrips() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        _ = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"record/write","#
                + #""params":{"mod":"notes","key":"tabs","text":"[1,\"a\"]"}}"#,
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
        #expect(
            response == (try json(
                #"{"jsonrpc":"2.0","id":2,"error":{"code":-32803,"message":"not a record key: A","#
                    + #""data":{"kind":"KEY"}}}"#
            ))
        )
    }

    @Test("an unknown method is not found")
    func unknownMethodIsNotFound() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":2,"method":"record/burn","params":{}}"#, to: sut)

        // Then
        #expect(
            response == (try json(
                #"{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"no method record/burn"}}"#
            ))
        )
    }

    @Test("params of the wrong shape are invalid")
    func wrongParamsAreInvalid() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":2,"method":"record/keys","params":{"key":"a"}}"#, to: sut)

        // Then
        #expect(
            response == (try json(
                #"{"jsonrpc":"2.0","id":2,"error":{"code":-32602,"message":"record/keys has no such params at mod"}}"#
            ))
        )
    }

    @Test("params of the wrong shape say where")
    func wrongParamsSayWhere() throws {
        // Given
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"runner/unload","params":{"mods":["a",5]}}"#,
            to: sut
        )

        // Then
        #expect(
            value(in: response, at: "error", "message") == .string("runner/unload has no such params at mods.1")
        )
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

    @Test("state written is read back by all, with no params asked")
    func stateRoundTrips() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        _ = try send(
            #"{"jsonrpc":"2.0","id":2,"method":"state/write","params":{"folder":"b","key":"k","text":"[]"}}"#,
            to: sut
        )

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":3,"method":"state/all"}"#, to: sut)

        // Then
        #expect(
            response == (try json(#"{"jsonrpc":"2.0","id":3,"result":[{"folder":"b","key":"k","text":"[]"}]}"#))
        )
    }

    @Test("initialize refuses a permission defined twice")
    func initializeRefusesPermissionDefinedTwice() throws {
        // Given
        let permission = #"{"id":"deckit.mods","name":"Mods","means":"All of them."}"#

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)","#
                + #""implementations":{},"api":"1.0.0","ship":[],"sources":[],"#
                + #""permissions":[\#(permission),\#(permission)]}}"#,
            to: sut
        )

        // Then
        #expect(
            response == (try json(
                #"{"jsonrpc":"2.0","id":1,"error":{"code":-32803,"#
                    + #""message":"the permission deckit.mods is defined twice","data":{"kind":"PERMISSION"}}}"#
            ))
        )
    }

    @Test("what a run contributed comes back with it, the layers' too, and a user connects to its exports")
    func contributionsRoundTrip() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("dep", adding: #"[interfaces]\#nprovides = { "dep/api" = [1] }"#)
        try mod("a", adding: #"[interfaces]\#nuses = { "dep/api" = 1 }"#)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(
            #"{"jsonrpc":"2.0","id":3,"method":"runner/load","#
                + #""params":{"mods":["dep"]}}"#,
            to: sut
        )
        let begin = #"{"jsonrpc":"2.0","id":4,"method":"connection/begin","params":"#
        _ = try send(begin + #"{"mod":"dep","run":1,"lifecycle":0}}"#, to: sut)
        let contributions = #"{"exportedIn":{"dep/api":0},"awaits":{},"layer":["a"]}"#
        let started = #"{"mod":"dep","run":1,"summary":{"x":true},"contributions":\#(contributions)}"#

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":5,"method":"runner/started","params":\#(started)}"#, to: sut)
        _ = try send(
            #"{"jsonrpc":"2.0","id":6,"method":"runner/load","#
                + #""params":{"mods":["a"]}}"#,
            to: sut
        )
        let connected = try send(begin + #"{"mod":"a","run":1,"lifecycle":0}}"#, to: sut)

        // Then
        guard case let .array(effects)? = value(in: response, at: "result"), let told = effects.first else {
            Issue.record("no effects in \(response)")
            return
        }
        #expect(value(in: told, at: "notification") == .string("didLaunch"))
        #expect(value(in: told, at: "summary", "x") == .bool(true))
        #expect(value(in: told, at: "contributions", "layer") == .array([.string("a")]))
        #expect(value(in: told, at: "contributions", "exportedIn") == .object(["dep/api": .number(0)]))
        #expect(
            value(in: connected, at: "result")
                == (try json(
                    #"[{"id":1,"name":"dep/api","dependent":{"mod":"a","run":1,"lifecycle":0},"#
                        + #""dependency":{"mod":"dep","run":1,"lifecycle":0}}]"#
                ))
        )
    }

    @Test("a mod at the relaunch limit loads no more until a mod granted deckit.mods asks that it launch")
    func relaunchLimitResetsAsAsked() throws {
        // Given
        try mod("a")
        try mod("m", adding: "[permissions]\n\"deckit.mods\" = \"to test\"")
        let permissions = #"[{"id":"deckit.mods","name":"Mods","means":"to test"}]"#
        _ = try send(
            #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":"#
                + initializeParams.replacing(#""permissions":[]"#, with: #""permissions":"# + permissions) + "}",
            to: sut
        )
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/load","params":{"mods":["m"]}}"#, to: sut)
        let load = #"{"jsonrpc":"2.0","id":3,"method":"runner/load","params":{"mods":["a"]}}"#
        for number in 1...5 {
            _ = try send(load, to: sut)
            _ = try send(
                #"{"jsonrpc":"2.0","id":4,"method":"runner/crash","params":{"mod":"a","run":\#(number),"#
                    + #""problem":"its page ended"}}"#,
                to: sut
            )
        }

        // When
        let held = try send(load, to: sut)
        let refused = try send(
            #"{"jsonrpc":"2.0","id":5,"method":"runner/launch","params":{"mod":"m","by":"a"}}"#,
            to: sut
        )
        let launched = try send(
            #"{"jsonrpc":"2.0","id":6,"method":"runner/launch","params":{"mod":"a","by":"m"}}"#,
            to: sut
        )

        // Then
        #expect(value(in: held, at: "result") == .array([]))
        #expect(value(in: refused, at: "error", "data", "kind") == .string("REFUSED"))
        guard case let .array(effects)? = value(in: launched, at: "result") else {
            Issue.record("runner/launch answered no effects: \(launched)")
            return
        }
        #expect(effects.count == 2)
    }

    @Test("a file inside a mod's folder is read as its text, and one a link takes outside it as null")
    func modFileIsRead() throws {
        // Given
        try mod("a")
        let folder = URL(filePath: home + "source").appending(path: "a")
        try Data("body {}".utf8).write(to: folder.appending(path: "page.css"))
        try Data("secret".utf8).write(to: URL(filePath: home + "secret.css"))
        try FileManager.default.createSymbolicLink(
            at: folder.appending(path: "outside.css"),
            withDestinationURL: URL(filePath: home + "secret.css")
        )
        _ = try send(initializeRequest, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)

        // When
        let inside = try send(
            #"{"jsonrpc":"2.0","id":3,"method":"catalog/read-file","params":{"mod":"a","path":"page.css"}}"#,
            to: sut
        )
        let outside = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"catalog/read-file","params":{"mod":"a","path":"outside.css"}}"#,
            to: sut
        )

        // Then
        #expect(value(in: inside, at: "result") == .string("body {}"))
        #expect(value(in: outside, at: "result") == .null)
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

    // MARK: - Private
    private func mod(_ id: String, adding extra: String = "") throws {
        let folder = URL(filePath: home + "source").appending(path: id)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let manifest = """
            id = "\(id)"
            version = "1.0.0"
            api = "1.0.0"
            main = "main.js"
            """ + (extra.isEmpty ? "" : "\n" + extra)
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
