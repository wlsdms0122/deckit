//
//  WebFetcher.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation
import WebKit

// A request sent as a data store's pages send one: with the cookies it holds and the user agent its pages send, the
// cookies the answers set kept in it. The answer is read as it arrives, past `limit` bytes refused.
@MainActor
struct WebFetcher {
    // MARK: - Property
    private let store: WKWebsiteDataStore
    private let applicationName: String

    // MARK: - Initializer
    init(store: WKWebsiteDataStore, applicationName: String) {
        self.store = store
        self.applicationName = applicationName
    }

    // MARK: - Public
    func answer(to request: WebRequest, limit: Int) async throws -> WebAnswer {
        let cookies = store.httpCookieStore
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpAdditionalHeaders = ["User-Agent": await Self.userAgent(applicationName)]
        guard let jar = configuration.httpCookieStorage else { throw NodeError(message: "no cookie storage to ask with") }
        for cookie in await cookies.allCookies() {
            jar.setCookie(cookie)
        }
        let sent = jar.cookies ?? []
        let session = URLSession(configuration: configuration)
        defer { session.finishTasksAndInvalidate() }

        do {
            let answer = try await read(request, limit: limit, in: session)
            await keep(jar.cookies ?? [], over: sent, in: cookies)

            return answer
        } catch {
            await keep(jar.cookies ?? [], over: sent, in: cookies)
            throw error
        }
    }

    // MARK: - Private
    // The user agent of a page whose configuration adds `applicationName`, as WebKit makes it.
    private static var userAgents: [String: String] = [:]

    private static func userAgent(_ applicationName: String) async -> String {
        if let known = userAgents[applicationName] { return known }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.applicationNameForUserAgent = applicationName
        let view = WKWebView(frame: .zero, configuration: configuration)
        let agent = (try? await view.evaluateJavaScript("navigator.userAgent")) as? String ?? ""
        userAgents[applicationName] = agent

        return agent
    }

    private func read(_ request: WebRequest, limit: Int, in session: URLSession) async throws -> WebAnswer {
        let gate = RedirectGate(request.redirect)
        let (bytes, response) = try await session.bytes(for: request.urlRequest, delegate: gate)
        if gate.refused { throw NodeError(message: "redirected, and the request's redirect is error") }
        guard let response = response as? HTTPURLResponse else { throw NodeError(message: "not answered over HTTP") }
        if response.expectedContentLength > limit {
            throw tooLarge(limit, Int(response.expectedContentLength))
        }
        var data = Data()
        for try await byte in bytes {
            data.append(byte)
            if data.count > limit { throw tooLarge(limit, data.count) }
        }

        return try WebAnswer(response, body: data, redirected: gate.redirected)
    }

    // What the answers set, changed or removed of the cookies `sent`, done in the store too.
    private func keep(_ answered: [HTTPCookie], over sent: [HTTPCookie], in store: WKHTTPCookieStore) async {
        let before = Dictionary(sent.map { (Self.key(of: $0), $0) }, uniquingKeysWith: { _, last in last })
        let after = Set(answered.map(Self.key(of:)))
        for cookie in answered {
            if let was = before[Self.key(of: cookie)], was.value == cookie.value, was.expiresDate == cookie.expiresDate {
                continue
            }
            await store.setCookie(cookie)
        }
        for cookie in sent where !after.contains(Self.key(of: cookie)) {
            await store.deleteCookie(cookie)
        }
    }

    private static func key(of cookie: HTTPCookie) -> String {
        "\(cookie.domain)\t\(cookie.path)\t\(cookie.name)"
    }

    private func tooLarge(_ limit: Int, _ bytes: Int) -> NodeError {
        NodeError(message: "response too large: more than \(limit) bytes (\(bytes))")
    }
}
