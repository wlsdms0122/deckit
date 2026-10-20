//
//  URLRouterTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
import Deck
@testable import Deckit

@Suite("URLRouter")
struct URLRouterTests {
    // MARK: - Property
    private let mods = ModHome("url-router-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("an address is offered to its scheme's handlers, the app's first, then to what deckit opens by itself")
    func testThatAnAddressIsRouted() throws {
        // Given
        try mods.write("a", urlSchemes: ["https"])
        try mods.write("b", urlSchemes: ["https"])
        try mods.write("c", urlSchemes: ["*"])
        let sut = try mods.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try sut.started(mod, run: 1, contributing: ["handleURL": .bool(true)])
        }

        // When
        let pressed = try route(sut, " HTTPS://example.com ", userInitiated: true)
        let unpressed = try route(sut, "https://example.com", userInitiated: false)
        let other = try route(sut, "mailto:someone@example.com", userInitiated: true)
        let ownApp = try route(sut, "https://example.com", userInitiated: true, usesDefaultApp: true)

        // Then
        #expect(pressed == "HTTPS://example.com -> b a c, browser")
        #expect(unpressed == "https://example.com -> b a c, none")
        #expect(other == "mailto:someone@example.com -> c, none")
        #expect(ownApp == "https://example.com -> , browser")
    }

    @Test("a file opens only on a press, and an address that is not a place opens nowhere")
    func testThatWhatIsNotAPlaceOrUnpressedOpensNowhere() throws {
        // Given
        try mods.write("a", urlSchemes: ["*"])
        let sut = try mods.deckit()
        _ = try sut.started("a", run: 1, contributing: ["handleURL": .bool(true)])

        // When
        let unpressed = try route(sut, "file:///tmp/a.txt", userInitiated: false)
        let pressed = try route(sut, "file:///tmp/a.txt", userInitiated: true)
        let script = try route(sut, "javascript:alert(1)", userInitiated: true)
        let unschemed = try route(sut, "example.com", userInitiated: true)

        // Then
        #expect(unpressed == "file:///tmp/a.txt -> , none")
        #expect(pressed == "file:///tmp/a.txt -> a, file")
        #expect(script == "javascript:alert(1) -> , none")
        #expect(unschemed == "example.com -> , none")
    }

    @Test("the person's order and switches stand over the app's, and stay over a restart")
    func testThatThePersonOrdersHandlers() throws {
        // Given
        try mods.write("a", urlSchemes: ["https"])
        try mods.write("b", urlSchemes: ["https"])
        try mods.write("c", urlSchemes: ["https"])
        let sut = try mods.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try sut.started(mod, run: 1, contributing: ["handleURL": .bool(true)])
        }

        // When
        let set = try sut.json("open/setHandlers", handlers("https", order: ["a", "b"], off: ["c"]))
        let restarted = try mods.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try restarted.started(mod, run: 1, contributing: ["handleURL": .bool(true)])
        }
        let lists = try restarted.json("open/handlerLists")

        // Then
        #expect(set == .bool(true))
        let https = try #require(lists.array.first { list in list["scheme"]?.string == "https" })
        let listed = https["handlers"]?.array.compactMap { handler in
            handler["id"]?.string.map { id in id + (handler["on"]?.bool == true ? "" : " off") }
        }
        #expect(lists.array.compactMap { list in list["scheme"]?.string } == ["http", "https", "file"])
        #expect(https["system"]?.string == "browser")
        #expect(listed == ["a", "b", "c off"])
        let routed = try route(restarted, "https://example.com", userInitiated: true)
        #expect(routed == "https://example.com -> a b, browser")
        #expect(throws: URLRouterError.noHandlers("mailto")) {
            try restarted.answer(Call(method: "open/setHandlers", params: handlers("mailto", order: [], off: [])))
        }
    }

    @Test("a mod that names schemes and registers no handleURL, or the other way, is told so and asked nothing")
    func testThatAnUnpairedHandlerIsAProblem() throws {
        // Given
        try mods.write("a", urlSchemes: ["https"])
        try mods.write("b")
        let sut = try mods.deckit()

        // When
        let a = try sut.started("a", run: 1, contributing: [:])
        let b = try sut.started("b", run: 1, contributing: ["handleURL": .bool(true)])

        // Then
        #expect(problem(of: a) == "manifest.toml names url-schemes, but start() registered no deck.handleURL()")
        #expect(
            problem(of: b)
                == "start() registered deck.handleURL(), but manifest.toml names no url-schemes, so nothing asks it"
        )
        #expect(try route(sut, "https://example.com", userInitiated: true) == "https://example.com -> , browser")
    }

    // MARK: - Private
    // `url -> handlers, system` as a test compares a route.
    private func route(
        _ sut: Deckit,
        _ url: String,
        userInitiated: Bool,
        usesDefaultApp: Bool = false
    ) throws -> String {
        let route = try sut.json(
            "open/route",
            .object([
                "url": .string(url),
                "userInitiated": .bool(userInitiated),
                "usesDefaultApp": .bool(usesDefaultApp)
            ])
        )
        let handlers = (route["handlers"]?.array ?? []).compactMap(\.string).joined(separator: " ")

        return "\(route["url"]?.string ?? "") -> \(handlers), \(route["system"]?.string ?? "none")"
    }

    private func handlers(_ scheme: String, order: [String], off: [String]) -> JSONValue {
        .object([
            "scheme": .string(scheme),
            "order": .array(order.map(JSONValue.string)),
            "off": .array(off.map(JSONValue.string))
        ])
    }

    private func problem(of effects: JSONValue) -> String? {
        effects.array.compactMap { effect in effect["problem"]?.string }.first
    }
}
