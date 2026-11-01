//
//  SchemeHandler.swift
//  DeckitWeb
//
//  Created by JSilver on 11/1/26.
//

import Foundation
import WebKit
import CNodeAPI

// A scheme of the page's own, each load of it answered by JavaScript, at once or later: `request` ({ url, method, body,
// reply }), and `reply({ status, type, body, file })`, the text of `body` or the bytes of the file at the path `file`,
// `status` 200 and `type` text/plain where it says none. A page waiting on a synchronous request waits until the
// reply.
@MainActor
final class SchemeHandler: NSObject, WKURLSchemeHandler {
    // MARK: - Property
    private let emitter: Emitter
    private var live: Set<ObjectIdentifier> = []

    // MARK: - Initializer
    init(emitter: Emitter) {
        self.emitter = emitter
    }

    // MARK: - Lifecycle
    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }

        let key = ObjectIdentifier(task)
        live.insert(key)
        let reply = Reply { [weak self] node, arguments in
            guard let self, live.remove(key) != nil else { return }
            let member = { (name: String) throws -> napi_value? in
                try arguments.first.flatMap { try node.member($0, name) }
            }
            let file = try member("file").map { try node.string($0) }
            let data = try file.map { try Data(contentsOf: URL(fileURLWithPath: $0)) }
                ?? Data((try member("body").map { try node.string($0) } ?? "").utf8)
            let response = HTTPURLResponse(
                url: url,
                statusCode: try member("status").map { Int(try node.number($0)) } ?? 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": try member("type").map { try node.string($0) } ?? "text/plain",
                    "Content-Length": "\(data.count)"
                ]
            )
            guard let response else { throw NodeError(message: "no response for \(url)") }
            task.didReceive(response)
            task.didReceive(data)
            task.didFinish()
        }
        emitter.emit("request", [
            "url": url.absoluteString,
            "method": task.request.httpMethod ?? "GET",
            "body": task.request.httpBody.flatMap { String(data: $0, encoding: .utf8) },
            "reply": reply
        ])
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {
        live.remove(ObjectIdentifier(task))
    }
}
