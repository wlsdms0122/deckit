//
//  ServerTests.swift
//  DeckitServerTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import DeckitServer

@Suite("Server")
struct ServerTests {
    // MARK: - Property
    private let home: String
    private let sut: Server

    // MARK: - Initializer
    init() {
        home = FileManager.default.temporaryDirectory.appending(path: "server-tests-\(UUID().uuidString)").path()
        sut = Server()
    }

    // MARK: - Test
    @Test("initialize answers an empty result")
    func testThatInitializeAnswers() throws {
        // Given
        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)"}}"#)

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
        let response = try respond(#"{"jsonrpc":"2.0","id":2,"method":"initialize","params":{"home":"\#(home)"}}"#)

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
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":2,"error":{"code":-32602,"message":"record/keys has no such params"}}"#)))
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

    @Test("settings written are read back as the JSON they were written as")
    func testThatSettingsRoundTrip() throws {
        // Given
        try initialize()
        _ = try respond(
            #"{"jsonrpc":"2.0","id":2,"method":"setting/write","params":{"mod":"notes","key":"wrap","value":true}}"#
        )
        _ = try respond(
            #"{"jsonrpc":"2.0","id":3,"method":"setting/write","params":{"mod":"notes","key":"size","value":14}}"#
        )

        // When
        let response = try respond(#"{"jsonrpc":"2.0","id":4,"method":"setting/read","params":{"mod":"notes"}}"#)

        // Then
        #expect(response == (try json(#"{"jsonrpc":"2.0","id":4,"result":{"wrap":true,"size":14}}"#)))
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

    // MARK: - Private
    private func initialize() throws {
        _ = try respond(#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"home":"\#(home)"}}"#)
    }

    private func respond(_ message: String) throws -> JSONValue {
        try json(String(decoding: try #require(sut.respond(to: Data(message.utf8))), as: UTF8.self))
    }

    private func json(_ text: String) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
    }
}
