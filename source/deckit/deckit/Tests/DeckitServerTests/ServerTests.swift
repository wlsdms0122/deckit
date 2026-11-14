//
//  ServerTests.swift
//  DeckitServerTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import CryptoKit
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
            + #""sources":["\#(home)source"],"permissions":[],"fields":[]}"#
        initializeRequest = #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":\#(initializeParams)}"#
        sut = Server()
    }

    // MARK: - Test
    @Test("initialize answers where deck keeps the mods and their data, how long a run is given and when a seat is idle")
    func initializeAnswersFoldersAndTimes() throws {
        // Given
        // When
        let response = try send(initializeRequest, to: sut)

        // Then
        #expect(value(in: response, at: "result", "mods") == .string(home + "/mods"))
        #expect(value(in: response, at: "result", "data") == .string(home + "/data"))
        #expect(value(in: response, at: "result", "timeout") == (try json(#"{"launch":20,"end":5}"#)))
        #expect(value(in: response, at: "result", "seats") == (try json(#"{"idleTime":300}"#)))
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
                    + #""data":{"kind":"INVALID_ARGUMENT","stage":"call"}}}"#
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

    @Test("initialize refuses deckit.mods handed in, as deckit defines it itself")
    func initializeRefusesModsPermissionHanded() throws {
        // Given
        let permission = #"{"id":"deckit.mods","name":"Mods","description":"All of them.","privileged":false}"#

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)","#
                + #""implementations":{},"api":"1.0.0","ship":[],"sources":[],"#
                + #""permissions":[\#(permission)],"fields":[]}}"#,
            to: sut
        )

        // Then
        #expect(
            response == (try json(
                #"{"jsonrpc":"2.0","id":1,"error":{"code":-32803,"#
                    + #""message":"the permission deckit.mods is defined twice","#
                    + #""data":{"kind":"PERMISSION","stage":"call"}}}"#
            ))
        )
    }

    @Test("initialize refuses a field handed in that deckit reads itself, with the kind FIELD")
    func initializeRefusesOwnFieldHanded() throws {
        // Given
        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)","#
                + #""implementations":{},"api":"1.0.0","ship":[],"sources":[],"permissions":[],"fields":["main"]}}"#,
            to: sut
        )

        // Then
        #expect(
            response == (try json(
                #"{"jsonrpc":"2.0","id":1,"error":{"code":-32803,"#
                    + #""message":"the manifest field main is defined twice","data":{"kind":"FIELD","stage":"call"}}}"#
            ))
        )
    }

    @Test("a mod found that does not load is read with why, its kind NOT_LOADABLE, and one that loads with none")
    func modNotLoadableIsReadWithItsKind() throws {
        // Given
        try mod("a")
        try mod("b", adding: #"colour = "blue""#)
        _ = try send(initializeRequest, to: sut)

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)

        // Then
        guard case let .array(mods)? = value(in: response, at: "result"), mods.count == 2 else {
            Issue.record("catalog/read answered no two mods: \(response)")
            return
        }
        #expect(value(in: mods[0], at: "problem") == nil)
        #expect(
            value(in: mods[1], at: "problem") == (try json(
                #"{"message":"manifest.toml has \"colour\", which is not a manifest field","kind":"NOT_LOADABLE"}"#
            ))
        )
    }

    @Test("a mod is read with the ids of the permissions it is granted: those it asks for that are defined here")
    func modIsReadWithWhatItIsGranted() throws {
        // Given
        let permission = #"{"id":"host.x","name":"X","description":"What x guards.","privileged":false}"#
        try mod("a", adding: "[permissions]\n\"host.x\" = \"to test\"\n\"host.y\" = \"to test\"")
        _ = try send(
            #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)","implementations":{},"#
                + #""api":"1.0.0","ship":[],"sources":["\#(home)source"],"permissions":[\#(permission)],"fields":[]}}"#,
            to: sut
        )

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)

        // Then
        guard case let .array(mods)? = value(in: response, at: "result"), mods.count == 1 else {
            Issue.record("catalog/read answered no one mod: \(response)")
            return
        }
        #expect(value(in: mods[0], at: "granted") == (try json(#"["host.x"]"#)))
    }

    @Test("what a run contributed comes back with it as deck reads it, and a user connects to its exports")
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
        #expect(value(in: told, at: "summary") == nil)
        #expect(value(in: told, at: "contributions") == (try json(#"{"exportedIn":{"dep/api":0},"awaits":{}}"#)))
        #expect(
            value(in: connected, at: "result")
                == (try json(
                    #"[{"id":1,"name":"dep/api","client":{"mod":"a","run":1,"lifecycle":0},"#
                        + #""service":{"mod":"dep","run":1,"lifecycle":0},"#
                        + #""credential":{"mod":"a","permissions":[]}}]"#
                ))
        )
    }

    @Test("a system mod granted deckit.reach-mods reaches a mod by id, which launches and connects with its credential")
    func reachConnectsWithCredential() throws {
        // Given
        let ship = home + "ship"
        try mod("t")
        try mod("r", in: ship, adding: "[permissions]\n\"deckit.reach-mods\" = \"to test\"")
        _ = try send(
            #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)","api":"1.0.0","#
                + #""ship":[{"folder":"\#(ship)/r","system":true}],"sources":["\#(home)source"],"#
                + #""permissions":[],"fields":[]}}"#,
            to: sut
        )
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/install-shipped"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":4,"method":"runner/load","params":{"mods":["r"]}}"#, to: sut)
        let begin = #"{"jsonrpc":"2.0","id":5,"method":"connection/begin","params":"#
        _ = try send(begin + #"{"mod":"r","run":1,"lifecycle":0}}"#, to: sut)
        let reach = #"{"mod":"r","run":1,"lifecycle":0,"target":"t"}"#

        // When
        let reached = try send(#"{"jsonrpc":"2.0","id":6,"method":"connection/reach","params":\#(reach)}"#, to: sut)
        _ = try send(begin + #"{"mod":"t","run":1,"lifecycle":0}}"#, to: sut)
        let started = try send(
            #"{"jsonrpc":"2.0","id":7,"method":"runner/started","#
                + #""params":{"mod":"t","run":1,"contributions":{"exportedIn":{"t":0},"awaits":{}}}}"#,
            to: sut
        )
        let released = try send(#"{"jsonrpc":"2.0","id":8,"method":"connection/release","params":\#(reach)}"#, to: sut)

        // Then
        let connection = #"{"id":1,"name":"t","client":{"mod":"r","run":1,"lifecycle":0},"#
            + #""service":{"mod":"t","run":1,"lifecycle":0},"#
            + #""credential":{"mod":"r","permissions":["deckit.reach-mods"]}}"#
        guard case let .array(waited)? = value(in: reached, at: "result"),
            case let .array(connected)? = value(in: started, at: "result")
        else {
            Issue.record("no effects in \(reached) or \(started)")
            return
        }
        let wait = #"{"effect":"wait","mod":"t","name":"t","client":{"mod":"r","run":1,"lifecycle":0}}"#
        #expect(waited.first == (try json(wait)))
        #expect(waited.contains { effect in value(in: effect, at: "notification") == .string("willLaunch") })
        #expect(connected.contains(try json(#"{"effect":"connect","connection":\#(connection)}"#)))
        let disconnect = #"[{"effect":"disconnect","connection":\#(connection)}]"#
        #expect(value(in: released, at: "result") == (try json(disconnect)))
    }

    @Test("a lifecycle that waits is answered as wait, with itself as its client")
    func waitNamesItsClient() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("dep", adding: #"[interfaces]\#nprovides = { "dep/api" = [1] }"#)
        try mod("a", adding: #"[interfaces]\#nuses = { "dep/api" = 1 }"#)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/load","params":{"mods":["a"]}}"#, to: sut)
        _ = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"connection/begin","params":{"mod":"a","run":1,"lifecycle":0}}"#,
            to: sut
        )
        let started = #"{"mod":"a","run":1,"contributions":{"exportedIn":{},"awaits":{"dep/api":0}}}"#

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":5,"method":"runner/started","params":\#(started)}"#, to: sut)

        // Then
        guard case let .array(effects)? = value(in: response, at: "result") else {
            Issue.record("no effects in \(response)")
            return
        }
        #expect(
            effects.contains(
                try json(
                    #"{"effect":"wait","mod":"dep","name":"dep/api","client":{"mod":"a","run":1,"lifecycle":0}}"#
                )
            )
        )
    }

    @Test("a lifecycle using an interface whose owner runs with no exports for it is answered as refuse, at call")
    func reachWithoutExportsIsRefused() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("dep", adding: #"[interfaces]\#nprovides = { "dep/api" = [1] }"#)
        try mod("a", adding: #"[interfaces]\#nuses = { "dep/api" = 1 }"#)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/load","params":{"mods":["a","dep"]}}"#, to: sut)
        let begin = #"{"jsonrpc":"2.0","id":4,"method":"connection/begin","params":"#
        _ = try send(begin + #"{"mod":"a","run":1,"lifecycle":0}}"#, to: sut)
        _ = try send(begin + #"{"mod":"dep","run":1,"lifecycle":0}}"#, to: sut)
        let started = #"{"exportedIn":{},"awaits":{}}}}"#
        _ = try send(
            #"{"jsonrpc":"2.0","id":5,"method":"runner/started","params":{"mod":"a","run":1,"contributions":"#
                + started,
            to: sut
        )

        // When
        let response = try send(
            #"{"jsonrpc":"2.0","id":6,"method":"runner/started","params":{"mod":"dep","run":1,"contributions":"#
                + started,
            to: sut
        )

        // Then
        guard case let .array(effects)? = value(in: response, at: "result") else {
            Issue.record("no effects in \(response)")
            return
        }
        let refuse = #"{"effect":"refuse","name":"dep/api","client":{"mod":"a","run":1,"lifecycle":0},"#
            + #""refusal":{"stage":"call","kind":"NOT_EXPORTED","#
            + #""message":"dep runs with no exports for dep/api that reach the lifecycle"}}"#
        #expect(effects.contains(try json(refuse)))
    }

    @Test("a lifecycle that waits for a mod whose run fails to launch is answered as wait again, with that refusal")
    func failedRunIsToldToItsWaiter() throws {
        // Given
        _ = try send(initializeRequest, to: sut)
        try mod("dep", adding: #"[interfaces]\#nprovides = { "dep/api" = [1] }"#)
        try mod("a", adding: #"[interfaces]\#nuses = { "dep/api" = 1 }"#)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":3,"method":"runner/load","params":{"mods":["a"]}}"#, to: sut)
        _ = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"connection/begin","params":{"mod":"a","run":1,"lifecycle":0}}"#,
            to: sut
        )
        let started = #"{"mod":"a","run":1,"contributions":{"exportedIn":{},"awaits":{}}}"#
        _ = try send(#"{"jsonrpc":"2.0","id":5,"method":"runner/started","params":\#(started)}"#, to: sut)

        // When
        let failed = try send(
            #"{"jsonrpc":"2.0","id":6,"method":"runner/not-started","params":{"mod":"dep","run":1,"problem":"threw"}}"#,
            to: sut
        )

        // Then
        guard case let .array(effects)? = value(in: failed, at: "result") else {
            Issue.record("no effects in \(failed)")
            return
        }
        let wait = #"{"effect":"wait","mod":"dep","name":"dep/api","client":{"mod":"a","run":1,"lifecycle":0},"#
            + #""refusal":{"stage":"launch","kind":"NOT_LAUNCHED","message":"dep did not launch: threw"}}"#
        #expect(effects.contains(try json(wait)))
        #expect(!effects.contains { effect in value(in: effect, at: "notification") == .string("willLaunch") })
    }

    @Test("a mod at the relaunch limit loads no more until a mod granted deckit.mods asks that it launch")
    func relaunchLimitResetsAsAsked() throws {
        // Given
        let ship = home + "ship"
        try mod("a")
        try mod("m", in: ship, adding: "[permissions]\n\"deckit.mods\" = \"to test\"")
        _ = try send(
            initializeRequest.replacing(#""ship":[]"#, with: #""ship":[{"folder":"\#(ship)/m","system":true}]"#),
            to: sut
        )
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/install-shipped"}"#, to: sut)
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
        #expect(value(in: refused, at: "error", "data", "kind") == .string("NOT_PERMITTED"))
        guard case let .array(effects)? = value(in: launched, at: "result") else {
            Issue.record("runner/launch answered no effects: \(launched)")
            return
        }
        #expect(effects.count == 2)
    }

    @Test("a launch asked with no by is not checked, and launches a mod at the relaunch limit")
    func launchWithNoByIsNotChecked() throws {
        // Given
        try mod("a")
        _ = try send(initializeRequest, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)
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
        let launched = try send(#"{"jsonrpc":"2.0","id":5,"method":"runner/launch","params":{"mod":"a"}}"#, to: sut)

        // Then
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

    @Test("a field's table of keys of one canonical form is answered with both, each with its value")
    func fieldKeysOfOneFormAreAnsweredApart() throws {
        // Given
        try mod("a", adding: "[view]\n\"caf\u{E9}\" = 1\n\"cafe\u{301}\" = 2")
        let initialize = initializeRequest.replacing(#""fields":[]"#, with: #""fields":["view"]"#)
        _ = try send(initialize, to: sut)

        // When
        let response = try send(#"{"jsonrpc":"2.0","id":2,"method":"catalog/read"}"#, to: sut)

        // Then
        guard case let .array(mods)? = value(in: response, at: "result"), mods.count == 1 else {
            Issue.record("catalog/read answered no one mod: \(response)")
            return
        }
        #expect(value(in: mods[0], at: "problem") == nil)
        #expect(
            value(in: mods[0], at: "manifest", "fields")
                == .object(["view": .object(["caf\u{E9}": .number(1), "cafe\u{301}": .number(2)])])
        )
    }

    @Test("a user that proves its key while the local seat is not idle is answered as asking, and sits as it is let")
    func admissionAsksThenSeats() throws {
        // Given
        let privateKey = Curve25519.Signing.PrivateKey()
        let key = privateKey.publicKey.rawRepresentation.base64EncodedString()
        let nonce = Data(repeating: 7, count: 32)
        _ = try send(initializeRequest, to: sut)
        _ = try send(#"{"jsonrpc":"2.0","id":2,"method":"user/add","params":{"id":"fable","name":"Fable"}}"#, to: sut)
        _ = try send(
            #"{"jsonrpc":"2.0","id":3,"method":"key/add","params":"#
                + #"{"principal":"fable","scheme":"ed25519","key":"\#(key)","name":"test"}}"#,
            to: sut
        )
        let challenged = try send(
            #"{"jsonrpc":"2.0","id":4,"method":"authentication/challenge","params":"#
                + #"{"transport":"t1","nonce":"\#(nonce.base64EncodedString())"}}"#,
            to: sut
        )
        guard case let .string(text)? = value(in: challenged, at: "result", "challenge") else {
            Issue.record("no challenge: \(challenged)")
            return
        }
        let challenge = try #require(Data(base64Encoded: text))
        let transcript = Data("deckit-authenticate-1".utf8) + [0] + Data("fable".utf8) + [0] + challenge + nonce
        let signature = try privateKey.signature(for: transcript).base64EncodedString()

        // When
        let asking = try send(
            #"{"jsonrpc":"2.0","id":5,"method":"authentication/verify","params":{"transport":"t1","#
                + #""principal":"fable","scheme":"ed25519","key":"\#(key)","signature":"\#(signature)","idle":12}}"#,
            to: sut
        )
        let seated = try send(
            #"{"jsonrpc":"2.0","id":6,"method":"seat/answer","params":{"transport":"t1","allow":true}}"#,
            to: sut
        )

        // Then
        let user = #"{"id":"fable","name":"Fable"}"#
        #expect(value(in: asking, at: "result") == (try json(#"{"asking":{"user":\#(user)}}"#)))
        #expect(value(in: seated, at: "result", "seat") == (try json(#"{"id":"s1","user":\#(user),"local":false}"#)))
        guard case let .array(effects)? = value(in: seated, at: "result", "effects") else {
            Issue.record("no effects: \(seated)")
            return
        }
        #expect(
            effects.first == (try json(
                #"{"effect":"open","mod":"fable","transport":"t1","permissions":["deckit.seat"]}"#
            ))
        )
    }

    // MARK: - Private
    private func mod(_ id: String, in parent: String? = nil, adding extra: String = "") throws {
        let folder = URL(filePath: parent ?? home + "source").appending(path: id)
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
            return fields[JSONName(key)]
        }
    }

    private func send(_ message: String, to server: Server) throws -> JSONValue {
        try json(String(decoding: try #require(server.respond(to: Data(message.utf8))), as: UTF8.self))
    }

    private func json(_ text: String) throws -> JSONValue {
        try JSONValue(data: Data(text.utf8))
    }
}
