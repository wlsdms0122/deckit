//
//  WebPageView.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import WebKit

// A web page's WKWebView, which tells when it takes the keyboard, keeps the files of the drop last performed on it, and
// hears the pointer where it is the page under it, in a key window of an app that is not active too (PointerRelay).
@MainActor
final class WebPageView: WKWebView {
    // MARK: - Property
    var onFocus: (() -> Void)?
    private(set) var droppedFiles: [URL] = []
    private lazy var relay = PointerRelay(view: self)
    private var relayed: NSTrackingArea?
    private var covered = false // whether the pointer has left it for a page laid over it

    // MARK: - Initializer
    // MARK: - Lifecycle
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let relayed { removeTrackingArea(relayed) }
        let area = NSTrackingArea(rect: .zero, options: [.mouseMoved, .activeAlways, .inVisibleRect], owner: relay)
        addTrackingArea(area)
        relayed = area
    }

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

    // A page under another hears the pointer only where it is the one under it, so the two do not each set the cursor.
    override func mouseMoved(with event: NSEvent) {
        guard isUnderPointer(event) else { return leave(event) }
        covered = false
        super.mouseMoved(with: event)
    }

    override func cursorUpdate(with event: NSEvent) {
        guard isUnderPointer(event) else { return }
        super.cursorUpdate(with: event)
    }

    // MARK: - Public
    // MARK: - Private
    private func isUnderPointer(_ event: NSEvent) -> Bool {
        guard let content = window?.contentView,
            let hit = content.hitTest(content.convert(event.locationInWindow, from: nil))
        else {
            return false
        }

        return hit.isDescendant(of: self)
    }

    // Once a page comes over it, the pointer moves off it, so nothing stays hovered under that page.
    private func leave(_ event: NSEvent) {
        guard !covered else { return }
        covered = true
        guard let outside = NSEvent.mouseEvent(
            with: .mouseMoved,
            location: convert(CGPoint(x: bounds.minX - 1, y: bounds.midY), to: nil),
            modifierFlags: event.modifierFlags,
            timestamp: event.timestamp,
            windowNumber: event.windowNumber,
            context: nil,
            eventNumber: 0,
            clickCount: 0,
            pressure: 0
        ) else {
            return
        }
        super.mouseMoved(with: outside)
    }
}
