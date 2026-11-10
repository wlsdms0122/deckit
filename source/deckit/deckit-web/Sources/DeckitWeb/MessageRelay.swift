//
//  MessageRelay.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import WebKit

// What deckit's scripts post in any frame, handed to their page with the frame. WebKit holds its handler, which holds
// the page only weakly, so a page is let go with its view.
@MainActor
final class MessageRelay: NSObject, WKScriptMessageHandler {
    // MARK: - Property
    private weak var page: WebPage?

    // MARK: - Initializer
    init(to page: WebPage) {
        self.page = page
    }

    // MARK: - Lifecycle
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        page?.received(message.body, from: message.frameInfo)
    }

    // MARK: - Public
    // MARK: - Private
}
