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
        // An answer read through the cache holds headers the cache writes, as an `expires` on a redirect it may keep.
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
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
        let (data, response) = try await BodyReader(gate: gate, limit: limit).read(request.urlRequest, in: session)
        if gate.refused { throw NodeError(message: "redirected, and the request's redirect is error") }
        guard let response = response as? HTTPURLResponse else { throw NodeError(message: "not answered over HTTP") }

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

}

// A request's answer read as it arrives, a block of bytes at a time, and stopped past `limit` bytes, its redirects
// handed to `gate`.
private final class BodyReader: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    typealias Read = (body: Data, response: URLResponse)

    // MARK: - Property
    private let gate: RedirectGate
    private let limit: Int
    private let lock = NSLock()
    private var body = Data()
    private var response: URLResponse?
    private var failure: Error?
    private var continuation: CheckedContinuation<Read, Error>?

    // MARK: - Initializer
    init(gate: RedirectGate, limit: Int) {
        self.gate = gate
        self.limit = limit
    }

    // MARK: - Lifecycle
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest
    ) async -> URLRequest? {
        await gate.urlSession(session, task: task, willPerformHTTPRedirection: response, newRequest: request)
    }

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse
    ) async -> URLSession.ResponseDisposition {
        lock.withLock { self.response = response }
        guard response.expectedContentLength > limit else { return .allow }
        lock.withLock { failure = tooLarge(Int(response.expectedContentLength)) }

        return .cancel
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        let over = lock.withLock {
            body.append(data)
            guard body.count > limit else { return false }
            failure = tooLarge(body.count)

            return true
        }
        if over { dataTask.cancel() }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let (continuation, outcome) = lock.withLock {
            let continuation = self.continuation
            self.continuation = nil

            return (continuation, outcome(of: error))
        }
        continuation?.resume(with: outcome)
    }

    // MARK: - Public
    func read(_ request: URLRequest, in session: URLSession) async throws -> Read {
        try await withCheckedThrowingContinuation { continuation in
            lock.withLock { self.continuation = continuation }
            let task = session.dataTask(with: request)
            task.delegate = self
            task.resume()
        }
    }

    // MARK: - Private
    // What the task came to, read while the lock is held.
    private func outcome(of error: Error?) -> Result<Read, Error> {
        if let failure { return .failure(failure) }
        if let error { return .failure(error) }
        guard let response else { return .failure(NodeError(message: "not answered")) }

        return .success((body, response))
    }

    private func tooLarge(_ bytes: Int) -> NodeError {
        NodeError(message: "response too large: more than \(limit) bytes (\(bytes))")
    }
}
