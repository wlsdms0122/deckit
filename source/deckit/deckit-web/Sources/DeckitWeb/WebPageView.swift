//
//  WebPageView.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import WebKit

// A web page's WKWebView, which tells when it takes the keyboard and keeps the files of the drop last performed on it.
@MainActor
final class WebPageView: WKWebView {
    // MARK: - Property
    var onFocus: (() -> Void)?
    private(set) var droppedFiles: [URL] = []

    // MARK: - Initializer
    // MARK: - Lifecycle
    override func becomeFirstResponder() -> Bool {
        let became = super.becomeFirstResponder()
        if became { onFocus?() }

        return became
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let files = sender.draggingPasteboard.readObjects(
            forClasses: [NSURL.self],
            options: [.urlReadingFileURLsOnly: true]
        ) as? [NSURL] ?? []
        droppedFiles = files.map { ($0.filePathURL ?? $0 as URL) }

        return super.performDragOperation(sender)
    }

    // MARK: - Public
    // MARK: - Private
}
