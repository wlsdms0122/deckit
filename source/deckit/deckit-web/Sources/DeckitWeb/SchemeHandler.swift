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
// `status` 200 and `type` text/plain where it says none. A file answered 200 answers the one range of its bytes a
// request asks for, as media loads do. A page waiting on a synchronous request waits until the reply.
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
            do {
                let member = { (name: String) throws -> napi_value? in
                    try arguments.first.flatMap { try node.member($0, name) }
                }
                let file = try member("file").map { try node.string($0) }
                var data = try file.map { try Data(contentsOf: URL(fileURLWithPath: $0), options: .alwaysMapped) }
                    ?? Data((try member("body").map { try node.string($0) } ?? "").utf8)
                var status = try member("status").map { Int(try node.number($0)) } ?? 200
                var headers = ["Content-Type": try member("type").map { try node.string($0) } ?? "text/plain"]
                if file != nil {
                    headers["Accept-Ranges"] = "bytes"
                    if status == 200,
                        let asked = task.request.value(forHTTPHeaderField: "Range"),
                        let bytes = Self.bytes(asked, of: data.count)
                    {
                        headers["Content-Range"] = "bytes \(bytes.lowerBound)-\(bytes.upperBound - 1)/\(data.count)"
                        data = data.subdata(in: bytes)
                        status = 206
                    }
                }
                headers["Content-Length"] = "\(data.count)"
                let response = HTTPURLResponse(
                    url: url,
                    statusCode: status,
                    httpVersion: "HTTP/1.1",
                    headerFields: headers
                )
                guard let response else { throw NodeError(message: "no response for \(url)") }
                task.didReceive(response)
                task.didReceive(data)
                task.didFinish()
            } catch {
                // A reply that cannot be made fails the load, so nothing waits on it.
                task.didFailWithError(error)
                throw error
            }
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

    // MARK: - Private
    // The bytes of `count` a Range header asks for, one range of them (`bytes=a-b`, `bytes=a-` or `bytes=-n`), or nil
    // for one it does not ask so or that is past the end: the whole is answered then.
    private static func bytes(_ header: String, of count: Int) -> Range<Int>? {
        guard header.hasPrefix("bytes="), !header.contains(",") else { return nil }
        let ends = header.dropFirst("bytes=".count).split(separator: "-", omittingEmptySubsequences: false)
        guard ends.count == 2 else { return nil }
        let (first, last) = (Int(ends[0]), Int(ends[1]))
        switch (first, last) {
        case let (start?, end?) where start <= end && start < count:
            return start..<min(end + 1, count)

        case let (start?, nil) where ends[1].isEmpty && start < count:
            return start..<count

        case let (nil, suffix?) where ends[0].isEmpty && suffix > 0 && count > 0:
            return max(count - suffix, 0)..<count

        default:
            return nil
        }
    }
}
