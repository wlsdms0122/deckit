//
//  WebAnswer.swift
//  DeckitWeb
//
//  Created by JSilver on 11/3/26.
//

import Foundation

// What a request was answered: the address that answered it, after the redirects followed, its status and headers,
// and its body whole.
struct WebAnswer {
    // MARK: - Property
    let url: URL
    let status: Int
    let headers: [(name: String, value: String)]
    let body: Data
    let redirected: Bool

    // As JavaScript reads it: `{ url, status, headers, body, redirected }`, `headers` `[[name, value]]`, one a name in
    // the order of the names, and `body` its bytes in base64.
    var value: [String: Any?] {
        [
            "url": url.absoluteString,
            "status": status,
            "headers": headers.map { [$0.name, $0.value] },
            "body": body.base64EncodedString(),
            "redirected": redirected
        ]
    }

    // MARK: - Initializer
    init(_ response: HTTPURLResponse, body: Data, redirected: Bool) throws {
        guard let url = response.url else { throw NodeError(message: "an answer came from no address") }
        self.url = url
        self.status = response.statusCode
        // The response's fields hold one value a name, a name it repeats joined by ", ".
        self.headers = response.allHeaderFields
            .compactMap { name, value in
                guard let name = name as? String else { return nil }

                return (name: name.lowercased(), value: "\(value)")
            }
            .sorted { $0.name < $1.name }
        self.body = body
        self.redirected = redirected
    }

    // MARK: - Public
    // MARK: - Private
}
