//
//  URLRouterTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("URLRouter")
struct URLRouterTests {
    // MARK: - Property
    private let fixture = DeckitFixture("url-router-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("an address is offered to its scheme's handlers, the app's first, then to what deckit opens by itself")
    func testThatAnAddressIsRouted() throws {
        // Given
        try fixture.write("a", urlSchemes: ["https"])
        try fixture.write("b", urlSchemes: ["https"])
        try fixture.write("c", urlSchemes: ["*"])
        let sut = try fixture.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try sut.started(mod, run: 1, contributing: ["handleURL": .bool(true)])
        }

        // When
        let pressed = route(sut, " HTTPS://example.com ", userInitiated: true)
        let unpressed = route(sut, "https://example.com", userInitiated: false)
        let other = route(sut, "mailto:someone@example.com", userInitiated: true)
        let ownApp = route(sut, "https://example.com", userInitiated: true, usesDefaultApp: true)

        // Then
        #expect(pressed == "HTTPS://example.com -> b a c, browser")
        #expect(unpressed == "https://example.com -> b a c, none")
        #expect(other == "mailto:someone@example.com -> c, none")
        #expect(ownApp == "https://example.com -> , browser")
    }

    @Test("a file opens only on a press, and an address that is not a place opens nowhere")
    func testThatWhatIsNotAPlaceOrUnpressedOpensNowhere() throws {
        // Given
        try fixture.write("a", urlSchemes: ["*"])
        let sut = try fixture.deckit()
        _ = try sut.started("a", run: 1, contributing: ["handleURL": .bool(true)])

        // When
        let unpressed = route(sut, "file:///tmp/a.txt", userInitiated: false)
        let pressed = route(sut, "file:///tmp/a.txt", userInitiated: true)
        let script = route(sut, "javascript:alert(1)", userInitiated: true)
        let unschemed = route(sut, "example.com", userInitiated: true)

        // Then
        #expect(unpressed == "file:///tmp/a.txt -> , none")
        #expect(pressed == "file:///tmp/a.txt -> a, file")
        #expect(script == "javascript:alert(1) -> , none")
        #expect(unschemed == "example.com -> , none")
    }

    @Test("the person's order and switches stand over the app's, and stay over a restart")
    func testThatThePersonOrdersHandlers() throws {
        // Given
        try fixture.write("a", urlSchemes: ["https"])
        try fixture.write("b", urlSchemes: ["https"])
        try fixture.write("c", urlSchemes: ["https"])
        let sut = try fixture.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try sut.started(mod, run: 1, contributing: ["handleURL": .bool(true)])
        }

        // When
        try sut.urlRouter.setHandlers(of: "https", order: ["a", "b"], off: ["c"])
        let restarted = try fixture.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try restarted.started(mod, run: 1, contributing: ["handleURL": .bool(true)])
        }
        let lists = restarted.urlRouter.handlerLists()

        // Then
        let https = try #require(lists.first { list in list.scheme == "https" })
        let listed = https.handlers.map { handler in handler.id + (handler.on ? "" : " off") }
        #expect(lists.map(\.scheme) == ["http", "https", "file"])
        #expect(https.system == .browser)
        #expect(listed == ["a", "b", "c off"])
        let routed = route(restarted, "https://example.com", userInitiated: true)
        #expect(routed == "https://example.com -> a b, browser")
        #expect(throws: URLRouterError.noHandlers("mailto")) {
            try restarted.urlRouter.setHandlers(of: "mailto", order: [], off: [])
        }
    }

    @Test("a mod that names schemes and registers no handleURL, or the other way, is told so and asked nothing")
    func testThatAnUnpairedHandlerIsAProblem() throws {
        // Given
        try fixture.write("a", urlSchemes: ["https"])
        try fixture.write("b")
        let sut = try fixture.deckit()

        // When
        let a = try sut.started("a", run: 1, contributing: [:])
        let b = try sut.started("b", run: 1, contributing: ["handleURL": .bool(true)])

        // Then
        #expect(a.problem == "manifest.toml names url-schemes, but start() registered no deck.handleURL()")
        #expect(
            b.problem
                == "start() registered deck.handleURL(), but manifest.toml names no url-schemes, so nothing asks it"
        )
        #expect(route(sut, "https://example.com", userInitiated: true) == "https://example.com -> , browser")
    }

    // MARK: - Private
    // `url -> handlers, system` as a test compares a route.
    private func route(_ sut: Deckit, _ url: String, userInitiated: Bool, usesDefaultApp: Bool = false) -> String {
        let route = sut.urlRouter.route(url, userInitiated: userInitiated, usesDefaultApp: usesDefaultApp)

        return "\(route.url) -> \(route.handlers.joined(separator: " ")), \(route.system?.rawValue ?? "none")"
    }
}
