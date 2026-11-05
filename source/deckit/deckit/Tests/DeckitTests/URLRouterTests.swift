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
        try fixture.write("a", urls: ["http:*", "https:*"])
        try fixture.write("github", urls: ["https://github.com/*"])
        try fixture.write("issues", urls: ["https://github.com/deckit/issues*"])
        let sut = try fixture.deckit(schemeHandlers: ["https": ["a"]])
        for mod in ["a", "github", "issues"] {
            _ = try sut.started(mod, run: 1, contributing: ["urls": .bool(true)])
        }

        // When
        let repository = route(sut, "https://GitHub.com/deckit", opensFiles: false)
        let issue = route(sut, "https://github.com/deckit/issues/1", opensFiles: false)
        let site = route(sut, "https://github.com", opensFiles: false)
        let other = route(sut, "https://example.com/github.com/", opensFiles: false)
        let lists = sut.urlRouter.handlerLists()
        try sut.urlRouter.setHandlers(of: "https", order: ["a", "github", "issues"], off: [])
        let placed = route(sut, "https://github.com/deckit/issues/1", opensFiles: false)

        // Then
        let https = try #require(lists.first { list in list.scheme == "https" })
        #expect(repository == "https://GitHub.com/deckit -> github a, browser")
        #expect(issue == "https://github.com/deckit/issues/1 -> issues github a, browser")
        #expect(site == "https://github.com -> github a, browser")
        #expect(other == "https://example.com/github.com/ -> a, browser")
        #expect(https.handlers.map(\.patterns) == [["https://github.com/deckit/issues*"], ["https://github.com/*"], ["https:*"]])
        #expect(placed == "https://github.com/deckit/issues/1 -> a github issues, browser")
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

    @Test("the person's order comes before the app's, and a mod no one placed after both at its width")
    func personsOrderComesBeforeTheApps() throws {
        // Given
        try fixture.write("a", urls: ["https:*"])
        try fixture.write("b", urls: ["https:*"])
        try fixture.write("c", urls: ["https:*"])
        let sut = try fixture.deckit(schemeHandlers: ["https": ["b"]])
        for mod in ["a", "b", "c"] {
            _ = try sut.started(mod, run: 1, contributing: ["urls": .bool(true)])
        }

        // When
        try sut.urlRouter.setHandlers(of: "https", order: ["a"], off: [])

        // Then
        #expect(route(sut, "https://example.com", opensFiles: false) == "https://example.com -> a b c, browser")
    }

    @Test("a mod stands in a scheme's list by its manifest, and is offered an address unless it runs unregistered")
    func membershipIsStatic() throws {
        // Given
        try fixture.write("a", urls: ["https:*"])
        try fixture.write("b", urls: ["https:*"])
        try fixture.write("other-api", api: "2.0.0", urls: ["https:*"])
        try fixture.write("wanting", urls: ["https:*"], requires: ["missing"])
        let sut = try fixture.deckit()

        // When
        let lists = sut.urlRouter.handlerLists()
        let notRunning = route(sut, "https://example.com", opensFiles: false)
        _ = try sut.started("a", run: 1, contributing: ["urls": .bool(true)])
        _ = try sut.started("b", run: 1, contributing: [:])
        let running = route(sut, "https://example.com", opensFiles: false)

        // Then
        let https = try #require(lists.first { list in list.scheme == "https" })
        #expect(https.handlers.map(\.id) == ["a", "b", "wanting"])
        #expect(notRunning == "https://example.com -> a b, browser")
        #expect(running == "https://example.com -> a, browser")
    }

    @Test("a mod's width at an address is its narrowest pattern that matches it, placed or not")
    func widthIsMeasuredPerAddress() throws {
        // Given
        try fixture.write("placed", urls: ["https:*", "https://example.com/deep*"])
        try fixture.write("github", urls: ["https://github.com/*"])
        try fixture.write("narrowed", urls: ["https:*", "https://example.com/x*"])
        try fixture.write("browser", urls: ["https:*"])
        let sut = try fixture.deckit(schemeHandlers: ["https": ["placed"]])
        for mod in ["placed", "github", "narrowed", "browser"] {
            _ = try sut.started(mod, run: 1, contributing: ["urls": .bool(true)])
        }

        // When
        let github = route(sut, "https://github.com/deckit", opensFiles: false)
        let narrowed = route(sut, "https://example.com/x/1", opensFiles: false)
        let deep = route(sut, "https://example.com/deep/1", opensFiles: false)
        let other = route(sut, "https://other.org", opensFiles: false)
        let lists = sut.urlRouter.handlerLists()

        // Then
        let https = try #require(lists.first { list in list.scheme == "https" })
        #expect(github == "https://github.com/deckit -> github placed browser narrowed, browser")
        #expect(narrowed == "https://example.com/x/1 -> narrowed placed browser, browser")
        #expect(deep == "https://example.com/deep/1 -> placed browser narrowed, browser")
        #expect(other == "https://other.org -> placed browser narrowed, browser")
        #expect(https.handlers.map(\.id) == ["github", "placed", "browser", "narrowed"])
    }

    @Test("a pattern is undecided while two mods no one placed wrote it and come first at its addresses, both on")
    func undecidedIsPerPattern() throws {
        // Given
        try fixture.write("browser", urls: ["https:*"])
        try fixture.write("narrowed", urls: ["https:*", "https://example.com/x*"])
        try fixture.write("github", urls: ["https://github.com/*"])
        try fixture.write("hub", urls: ["https://github.com/*"])
        try fixture.write("issues", urls: ["https://github.com/deckit/*"])
        let sut = try fixture.deckit()

        // When
        let unplaced = undecided(sut, "https")
        try sut.urlRouter.setHandlers(of: "https", order: ["browser"], off: [])
        let placed = undecided(sut, "https")
        try sut.urlRouter.setHandlers(of: "https", order: [], off: ["hub"])
        let off = undecided(sut, "https")

        // Then
        #expect(unplaced == ["https:*", "https://github.com/*"])
        #expect(placed == ["https://github.com/*"])
        #expect(off == [])
    }

    @Test("every address is undecided in each list where two mods no one placed take it first")
    func everyAddressIsUndecidedPerList() throws {
        // Given
        try fixture.write("one", urls: ["*"])
        try fixture.write("two", urls: ["*"])
        try fixture.write("mail", urls: ["mailto:*"])
        let sut = try fixture.deckit()

        // When
        let every = undecided(sut, "*")
        let http = undecided(sut, "http")
        let mailto = undecided(sut, "mailto")

        // Then
        #expect(every == ["*"])
        #expect(http == ["*"])
        #expect(mailto == [])
    }

    @Test("a drag places the moved mod and those above it, and a narrow mod no one placed stays first at its addresses")
    func dragPlacesUpToTheMovedMod() throws {
        // Given
        try fixture.write("a", urls: ["https:*"])
        try fixture.write("b", urls: ["https:*"])
        try fixture.write("github", urls: ["https://github.com/*"])
        let sut = try fixture.deckit()
        for mod in ["a", "b", "github"] {
            _ = try sut.started(mod, run: 1, contributing: ["urls": .bool(true)])
        }
        let shown = try #require(sut.urlRouter.handlerLists().first { list in list.scheme == "https" })

        // When
        try sut.urlRouter.setHandlers(of: "https", order: ["b"], off: [])
        let moved = try #require(sut.urlRouter.handlerLists().first { list in list.scheme == "https" })
        let github = route(sut, "https://github.com/deckit", opensFiles: false)
        try sut.urlRouter.setHandlers(of: "https", order: ["github", "a"], off: [])
        let above = try #require(sut.urlRouter.handlerLists().first { list in list.scheme == "https" })

        // Then
        #expect(shown.handlers.map(\.id) == ["github", "a", "b"])
        #expect(moved.handlers.map(\.id) == ["github", "b", "a"])
        #expect(github == "https://github.com/deckit -> github b a, browser")
        #expect(above.handlers.map(\.id) == ["github", "a", "b"])
        #expect(route(sut, "https://example.com", opensFiles: false) == "https://example.com -> a b, browser")
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
    private func undecided(_ sut: Deckit, _ scheme: String) -> [String]? {
        sut.urlRouter.handlerLists().first { list in list.scheme == scheme }?.undecided
    }

    // `url -> handlers, system` as a test compares a route.
    private func route(_ sut: Deckit, _ url: String, opensFiles: Bool, usesDefaultApp: Bool = false) -> String {
        let route = sut.urlRouter.route(url, opensFiles: opensFiles, usesDefaultApp: usesDefaultApp)

        return "\(route.url) -> \(route.handlers.joined(separator: " ")), \(route.system?.rawValue ?? "none")"
    }
}
