//
//  WebPageView.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import WebKit

// A web page's WKWebView, which tells when it takes the keyboard.
@MainActor
final class WebPageView: WKWebView {
    // MARK: - Property
    var onFocus: (() -> Void)?

    // MARK: - Initializer
    // MARK: - Lifecycle
    override func becomeFirstResponder() -> Bool {
        let became = super.becomeFirstResponder()
        if became { onFocus?() }

        return became
    }

    // MARK: - Public
    // MARK: - Private
}
