//
//  RedirectGate.swift
//  DeckitWeb
//
//  Created by JSilver on 11/3/26.
//

import Foundation

// What a request does with each redirect it is answered, as its `redirect` says: `follow` goes on, `manual` stops
// with the redirect as the answer, and `error` stops with it refused.
final class RedirectGate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    // MARK: - Property
    private let policy: WebRequest.Redirect
    private let lock = NSLock()
    private var followed = 0
    private var stopped = false

    var redirected: Bool { lock.withLock { followed > 0 } }
    var refused: Bool { lock.withLock { stopped && policy == .error } }

    // MARK: - Initializer
    init(_ policy: WebRequest.Redirect) {
        self.policy = policy
    }

    // MARK: - Lifecycle
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest
    ) async -> URLRequest? {
        lock.withLock {
            guard policy == .follow else {
                stopped = true
                return nil
            }
            followed += 1

            return request
        }
    }

    // MARK: - Public
    // MARK: - Private
}
