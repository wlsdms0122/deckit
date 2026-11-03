//
//  WebFetcher.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation
import WebKit

// The text at a web address, asked as a data store's pages would ask: with the cookies it holds and the user agent its
// pages send, the cookies the answer sets kept in it; read as it arrives, past `limit` bytes refused.
@MainActor
struct WebFetcher {
    // MARK: - Property
    private let store: UUID
    private let applicationName: String

    // MARK: - Initializer
    init(store: UUID, applicationName: String) {
        self.store = store
        self.applicationName = applicationName
    }

    // MARK: - Public
    func text(at url: URL, limit: Int) async throws -> String {
        let cookies = WKWebsiteDataStore(forIdentifier: store).httpCookieStore
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
            let text = try await read(url, limit: limit, in: session)
            await keep(jar.cookies ?? [], over: sent, in: cookies)

            return text
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

    private func read(_ url: URL, limit: Int, in session: URLSession) async throws -> String {
        let (bytes, response) = try await session.bytes(from: url)
        if let response = response as? HTTPURLResponse, !(200..<300).contains(response.statusCode) {
            let reason = HTTPURLResponse.localizedString(forStatusCode: response.statusCode)
            throw NodeError(message: "HTTP \(response.statusCode) \(reason)")
        }
        if response.expectedContentLength > limit {
            throw tooLarge(limit, Int(response.expectedContentLength))
        }
        var data = Data()
        for try await byte in bytes {
            data.append(byte)
            if data.count > limit { throw tooLarge(limit, data.count) }
        }

        return String(decoding: data, as: UTF8.self)
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
