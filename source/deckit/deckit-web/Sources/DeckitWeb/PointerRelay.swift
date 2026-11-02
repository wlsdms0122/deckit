//
//  PointerRelay.swift
//  DeckitWeb
//
//  Created by JSilver on 11/2/26.
//

import AppKit

// The pointer's moves over a page in the key window while the app is not active, handed to the page as AppKit hands a
// view its moves. WebKit tracks the pointer only while the app is active, and a floating window takes the keyboard
// without bringing the app forward.
@MainActor
final class PointerRelay: NSResponder {
    // MARK: - Property
    private weak var view: NSView?

    // MARK: - Initializer
    init(view: NSView) {
        self.view = view
        super.init()
    }

    required init?(coder: NSCoder) { nil }

    // MARK: - Lifecycle
    override func mouseMoved(with event: NSEvent) {
        guard !NSApp.isActive, let view, view.window?.isKeyWindow == true else { return }
        view.mouseMoved(with: event)
    }

    // MARK: - Public
    // MARK: - Private
}
