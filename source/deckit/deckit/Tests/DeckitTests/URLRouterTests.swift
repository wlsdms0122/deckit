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
    func addressIsRouted() throws {
        // Given
        try fixture.write("a", urls: ["https:*"])
        try fixture.write("b", urls: ["https:*"])
        try fixture.write("c", urls: ["*"])
        let sut = try fixture.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try sut.started(mod, run: 1, contributing: ["urls": .bool(true)])
        }

        // When
        let web = route(sut, " HTTPS://example.com ", opensFiles: false)
        let other = route(sut, "mailto:someone@example.com", opensFiles: false)
        let ownApp = route(sut, "https://example.com", opensFiles: false, usesDefaultApp: true)

        // Then
        #expect(web == "HTTPS://example.com -> b a c, browser")
        #expect(other == "mailto:someone@example.com -> c, none")
        #expect(ownApp == "https://example.com -> , browser")
    }

    @Test("a file goes only where the caller may hand files on, and an address that is not a place opens nowhere")
    func whatIsNotAPlaceOrAFileNotHandedOnOpensNowhere() throws {
        // Given
        try fixture.write("a", urls: ["*"])
        let sut = try fixture.deckit()
        _ = try sut.started("a", run: 1, contributing: ["urls": .bool(true)])

        // When
        let kept = route(sut, "file:///tmp/a.txt", opensFiles: false)
        let handedOn = route(sut, "file:///tmp/a.txt", opensFiles: true)
        let script = route(sut, "javascript:alert(1)", opensFiles: true)
        let unschemed = route(sut, "example.com", opensFiles: true)

        // Then
        #expect(kept == "file:///tmp/a.txt -> , none")
        #expect(handedOn == "file:///tmp/a.txt -> a, file")
        #expect(script == "javascript:alert(1) -> , none")
        #expect(unschemed == "example.com -> , none")
    }

    @Test("an address goes to the handlers whose patterns match it, one no one placed before a wider one")
    func addressGoesToMatchingPatterns() throws {
        // Given
        try fixture.write("browser", urls: ["http:*", "https:*"])
        try fixture.write("github", urls: ["https://github.com/*"])
        try fixture.write("issues", urls: ["https://github.com/deckit/issues*"])
        let sut = try fixture.deckit(schemeHandlers: ["https": ["browser"]])
        for mod in ["browser", "github", "issues"] {
            _ = try sut.started(mod, run: 1, contributing: ["urls": .bool(true)])
        }

        // When
        let repository = route(sut, "https://GitHub.com/deckit", opensFiles: false)
        let issue = route(sut, "https://github.com/deckit/issues/1", opensFiles: false)
        let site = route(sut, "https://github.com", opensFiles: false)
        let other = route(sut, "https://example.com/github.com/", opensFiles: false)
        let lists = sut.urlRouter.handlerLists()
        try sut.urlRouter.setHandlers(of: "https", order: ["browser", "github", "issues"], off: [])
        let placed = route(sut, "https://github.com/deckit/issues/1", opensFiles: false)

        // Then
        let https = try #require(lists.first { list in list.scheme == "https" })
        #expect(repository == "https://GitHub.com/deckit -> github browser, browser")
        #expect(issue == "https://github.com/deckit/issues/1 -> issues github browser, browser")
        #expect(site == "https://github.com -> github browser, browser")
        #expect(other == "https://example.com/github.com/ -> browser, browser")
        #expect(https.handlers.map(\.patterns) == [["https://github.com/deckit/issues*"], ["https://github.com/*"], ["https:*"]])
        #expect(placed == "https://github.com/deckit/issues/1 -> browser github issues, browser")
    }

    @Test("the person's order and switches stand over the app's, and stay over a restart")
    func personOrdersHandlers() throws {
        // Given
        try fixture.write("a", urls: ["https:*"])
        try fixture.write("b", urls: ["https:*"])
        try fixture.write("c", urls: ["https:*"])
        let sut = try fixture.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try sut.started(mod, run: 1, contributing: ["urls": .bool(true)])
        }

        // When
        try sut.urlRouter.setHandlers(of: "https", order: ["a", "b"], off: ["c"])
        let restarted = try fixture.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try restarted.started(mod, run: 1, contributing: ["urls": .bool(true)])
        }
        let lists = restarted.urlRouter.handlerLists()
        let routed = route(restarted, "https://example.com", opensFiles: false)
        let unhandled = Result { try restarted.urlRouter.setHandlers(of: "mailto", order: [], off: []) }

        // Then
        let https = try #require(lists.first { list in list.scheme == "https" })
        let listed = https.handlers.map { handler in handler.id + (handler.on ? "" : " off") }
        #expect(lists.map(\.scheme) == ["http", "https", "file"])
        #expect(https.system == .browser)
        #expect(listed == ["a", "b", "c off"])
        #expect(routed == "https://example.com -> a b, browser")
        #expect(throws: URLRouterError.noHandlers("mailto")) { try unhandled.get() }
    }

    @Test("a mod that registers a handler and names no urls is told so, and one that has not registered it is passed")
    func unpairedHandlerIsAProblem() throws {
        // Given
        try fixture.write("a", urls: ["https:*"])
        try fixture.write("b")
        let sut = try fixture.deckit()

        // When
        let a = try sut.started("a", run: 1, contributing: [:])
        let b = try sut.started("b", run: 1, contributing: ["urls": .bool(true)])

        // Then
        #expect(a.problem == nil)
        #expect(b.problem == "it registered urls.register(), but manifest.toml names no urls, so nothing asks it")
        #expect(route(sut, "https://example.com", opensFiles: false) == "https://example.com -> , browser")
    }

    // MARK: - Private
    // `url -> handlers, system` as a test compares a route.
    private func route(_ sut: Deckit, _ url: String, opensFiles: Bool, usesDefaultApp: Bool = false) -> String {
        let route = sut.urlRouter.route(url, opensFiles: opensFiles, usesDefaultApp: usesDefaultApp)

        return "\(route.url) -> \(route.handlers.joined(separator: " ")), \(route.system?.rawValue ?? "none")"
    }
}
