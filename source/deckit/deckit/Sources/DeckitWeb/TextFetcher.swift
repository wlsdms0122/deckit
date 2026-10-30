//
//  TextFetcher.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation
import WebKit

// The text at a web address, asked with the cookies a data store holds, as its pages would ask, and read as it
// arrives, past `limit` bytes refused.
@MainActor
struct TextFetcher {
    // MARK: - Property
    private let store: UUID

    // MARK: - Initializer
    init(store: UUID) {
        self.store = store
    }

    // MARK: - Public
    func text(at url: URL, limit: Int) async throws -> String {
        let configuration = URLSessionConfiguration.ephemeral
        let cookies = configuration.httpCookieStorage
        for cookie in await WKWebsiteDataStore(forIdentifier: store).httpCookieStore.allCookies() {
            cookies?.setCookie(cookie)
        }
        let session = URLSession(configuration: configuration)
        defer { session.finishTasksAndInvalidate() }

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

    // MARK: - Private
    private func tooLarge(_ limit: Int, _ bytes: Int) -> NodeError {
        NodeError(message: "response too large: more than \(limit) bytes (\(bytes))")
    }
}
