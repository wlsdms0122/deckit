//
//  MessageRelay.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import WebKit

// What deckit's scripts post in any frame, handed to their page with the frame and the reply to the post. WebKit holds
// its handler, which holds the page only weakly, so a page is let go with its view.
@MainActor
final class MessageRelay: NSObject, WKScriptMessageHandlerWithReply {
    // MARK: - Property
    private weak var page: WebPage?

    // MARK: - Initializer
    init(to page: WebPage) {
        self.page = page
    }

    // MARK: - Lifecycle
    func userContentController(
        _ controller: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
    ) {
        guard let page else { return replyHandler(nil, nil) }
        page.received(message.body, named: message.name, from: message.frameInfo, reply: replyHandler)
    }

    // MARK: - Public
    // MARK: - Private
}
