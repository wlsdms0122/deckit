//
//  WebPageHost.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit

// What holds a web page over the view that draws its mod's page, filling that view: the page is at its frame in it.
// The mouse passes to the mod's page everywhere but on the web page.
@MainActor
final class WebPageHost: NSView {
    // MARK: - Property
    private let content: NSView

    override var isFlipped: Bool { true }

    // MARK: - Initializer
    init(content: NSView) {
        self.content = content
        super.init(frame: .zero)
        // Sized with the mod's page in the same pass, the page keeps its margins until the mod's page tells its place.
        content.autoresizingMask = [.width, .height]
        addSubview(content)
    }

    required init?(coder: NSCoder) {
        nil
    }

    // MARK: - Lifecycle
    // `point` is in the superview's space.
    override func hitTest(_ point: NSPoint) -> NSView? {
        guard content.frame.contains(convert(point, from: superview)) else { return nil }

        return super.hitTest(point)
    }

    // MARK: - Public
    // `frame` is in this view's space, from its top left.
    func lay(_ frame: CGRect) {
        guard frame != content.frame else { return }

        content.frame = frame
    }

    // MARK: - Private
}
