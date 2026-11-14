//
//  RequestTests.swift
//  DeckitServerTests
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Testing
@testable import Deck
@testable import DeckitServer

@Suite("Request")
struct RequestTests {
    // MARK: - Property
    private static let shapeless = [
        #"[1]"#,
        #"{"id":1}"#,
        #"{"id":"one","method":"state/all"}"#,
        #"{"id":1.5,"method":"state/all"}"#,
        #"{"id":1,"method":2}"#
    ]

    // MARK: - Initializer
    // MARK: - Test
    @Test("params are kept as the message writes them, two names of one canonical form as two")
    func paramsKeepTheirNames() throws {
        // Given
        let message = "{\"id\":2,\"method\":\"m\",\"params\":{\"view\":{\"caf\u{E9}\":1,\"cafe\u{301}\":2}}}"

        // When
        let sut = try Request(JSONValue(data: Data(message.utf8)))

        // Then
        #expect(sut.id == 2)
        #expect(sut.method == "m")
        #expect(sut.params == .object(["view": .object(["caf\u{E9}": .number(1), "cafe\u{301}": .number(2)])]))
    }

    @Test("a message with no id, or a null one, is a notification, and its params are none when it writes none")
    func notificationHasNoId() throws {
        // Given
        let messages = [#"{"method":"m"}"#, #"{"id":null,"method":"m"}"#]

        // When
        let requests = try messages.map { message in try Request(JSONValue(data: Data(message.utf8))) }

        // Then
        #expect(requests.map(\.id) == [nil, nil])
        #expect(requests.map(\.params) == [nil, nil])
    }

    @Test("params are decoded as the type a method takes")
    func paramsAreDecodedAsTyped() throws {
        // Given
        let message = #"{"id":2,"method":"record/read","params":{"mod":"notes","key":"tabs"}}"#
        let sut = try Request(JSONValue(data: Data(message.utf8)))

        // When
        let params = try sut.decodeParams(as: ModKeyParams.self)

        // Then
        #expect(params.mod == "notes")
        #expect(params.key == "tabs")
    }

    @Test("JSON that is no request is refused as a mismatch", arguments: shapeless)
    func shapelessIsRefused(message: String) throws {
        // Given
        let value = try JSONValue(data: Data(message.utf8))

        // When
        let sut = Result { try Request(value) }

        // Then
        #expect {
            try sut.get()
        } throws: { error in
            guard case DecodingError.typeMismatch = error else { return false }
            return true
        }
    }
}
