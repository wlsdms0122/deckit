//
//  WebRequest.swift
//  DeckitWeb
//
//  Created by JSilver on 11/3/26.
//

import Foundation
import CNodeAPI

// A request as a page's `fetch` makes it: `{ url, method, headers, body, redirect }`, `headers` `[[name, value]]`,
// `body` its bytes in base64 or null, `redirect` `follow`, `error` or `manual`.
struct WebRequest {
    enum Redirect: String {
        case follow
        case error
        case manual
    }

    // MARK: - Property
    let url: URL
    let method: String
    let headers: [(name: String, value: String)]
    let body: Data?
    let redirect: Redirect

    var urlRequest: URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        for (name, value) in headers {
            request.addValue(value, forHTTPHeaderField: name)
        }
        request.httpBody = body

        return request
    }

    // MARK: - Initializer
    @MainActor
    init(_ value: napi_value, in node: Node) throws {
        func member(_ name: String) throws -> napi_value {
            guard let member = try node.member(value, name), !node.isNothing(member) else {
                throw NodeError(message: "a request has no \(name)")
            }

            return member
        }

        let address = try node.string(try member("url"))
        guard let url = URL(string: address) else { throw NodeError(message: "not an address: \(address)") }
        let redirect = try node.string(try member("redirect"))
        guard let policy = Redirect(rawValue: redirect) else {
            throw NodeError(message: "a redirect is follow, error or manual, not \(redirect)")
        }
        self.url = url
        self.method = try node.string(try member("method"))
        self.headers = try node.array(try member("headers")).map { pair in
            let parts = try node.array(pair)
            guard parts.count == 2 else { throw NodeError(message: "a header is [name, value]") }

            return (name: try node.string(parts[0]), value: try node.string(parts[1]))
        }
        let body = try node.member(value, "body").flatMap { node.isNothing($0) ? nil : try node.string($0) }
        if let body, Data(base64Encoded: body) == nil { throw NodeError(message: "a request's body is not base64") }
        self.body = body.flatMap { Data(base64Encoded: $0) }
        self.redirect = policy
    }

    // MARK: - Public
    // MARK: - Private
}
