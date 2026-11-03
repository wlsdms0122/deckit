//
//  WebPageView.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import WebKit

// A web page's WKWebView, which tells when it takes the keyboard, takes it only as it is given it or pressed unless it
// `takesKeyboard` as its document focuses an element, keeps the files of the drop last performed on it, and
// hears the pointer only where it is the page under it, in a key window of an app that is not active too
// (PointerRelay). WebKit tracks the pointer through tracking areas of its own, which each page is given behind a gate
// (TrackingGate), so a page under another does not answer the moves too and set its own cursor.
@MainActor
final class WebPageView: WKWebView {
    // MARK: - Property
    var onFocus: (() -> Void)?
    var takesKeyboard = true
    private var given = false // whether the keyboard is being handed to it
    private(set) var droppedFiles: [URL] = []
    private lazy var relay = PointerRelay(view: self)
    private var relayed: NSTrackingArea?
    private var covered = false // whether the pointer has left it for a page laid over it
    private var gated: [ObjectIdentifier: (area: NSTrackingArea, gate: TrackingGate)] = [:] // WebKit's area -> its gate

    // MARK: - Initializer
    // MARK: - Lifecycle
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let relayed { removeTrackingArea(relayed) }
        let area = NSTrackingArea(rect: .zero, options: [.mouseMoved, .activeAlways, .inVisibleRect], owner: relay)
        addTrackingArea(area)
        relayed = area
    }

    override func addTrackingArea(_ trackingArea: NSTrackingArea) {
        guard let owner = trackingArea.owner, owner !== self, !(owner is PointerRelay) else {
            return super.addTrackingArea(trackingArea)
        }
        let gate = TrackingGate(view: self, owner: owner)
        let area = NSTrackingArea(
            rect: trackingArea.rect,
            options: trackingArea.options,
            owner: gate,
            userInfo: trackingArea.userInfo
        )
        gated[ObjectIdentifier(trackingArea)] = (area, gate)
        super.addTrackingArea(area)
    }

    override func removeTrackingArea(_ trackingArea: NSTrackingArea) {
        super.removeTrackingArea(gated.removeValue(forKey: ObjectIdentifier(trackingArea))?.area ?? trackingArea)
    }

    override func becomeFirstResponder() -> Bool {
        guard takesKeyboard || given || isPressed() else { return false }
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
        guard hears(event) else { return }
        super.mouseMoved(with: event)
    }

    override func cursorUpdate(with event: NSEvent) {
        guard isUnderPointer(event) else { return }
        super.cursorUpdate(with: event)
    }

    // MARK: - Public
    // The keyboard handed to it, in its window.
    func take() {
        given = true
        window?.makeFirstResponder(self)
        given = false
    }

    // Whether a move of the pointer is this page's, the one under it; once it is not, the pointer has left it.
    func hears(_ event: NSEvent) -> Bool {
        guard isUnderPointer(event) else {
            leave(event)
            return false
        }
        covered = false

        return true
    }

    func isUnderPointer(_ event: NSEvent) -> Bool {
        guard let content = window?.contentView,
            let hit = content.hitTest(content.convert(event.locationInWindow, from: nil))
        else {
            return false
        }

        return hit.isDescendant(of: self)
    }

    // MARK: - Private
    // Whether the event under way is a press of the mouse on it.
    private func isPressed() -> Bool {
        guard let event = NSApp.currentEvent, event.window === window,
            [.leftMouseDown, .rightMouseDown, .otherMouseDown].contains(event.type)
        else {
            return false
        }

        return isUnderPointer(event)
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

// What WebKit's own tracking area hears, handed to WebKit only while its page is the one under the pointer. Leaving is
// always handed on, so the page never keeps a pointer that left it.
@MainActor
final class TrackingGate: NSObject {
    // MARK: - Property
    private weak var view: WebPageView?
    private weak var owner: AnyObject?

    // MARK: - Initializer
    init(view: WebPageView, owner: AnyObject) {
        self.view = view
        self.owner = owner
        super.init()
    }

    // MARK: - Lifecycle
    @objc(mouseMoved:)
    func mouseMoved(_ event: NSEvent) {
        guard view?.hears(event) == true else { return }
        hand(#selector(NSResponder.mouseMoved(with:)), event)
    }

    @objc(mouseEntered:)
    func mouseEntered(_ event: NSEvent) {
        guard view?.isUnderPointer(event) == true else { return }
        hand(#selector(NSResponder.mouseEntered(with:)), event)
    }

    @objc(mouseExited:)
    func mouseExited(_ event: NSEvent) {
        hand(#selector(NSResponder.mouseExited(with:)), event)
    }

    @objc(cursorUpdate:)
    func cursorUpdate(_ event: NSEvent) {
        guard view?.isUnderPointer(event) == true else { return }
        hand(#selector(NSResponder.cursorUpdate(with:)), event)
    }

    // MARK: - Public
    // MARK: - Private
    private func hand(_ selector: Selector, _ event: NSEvent) {
        guard let owner = owner as? NSObject, owner.responds(to: selector) else { return }
        owner.perform(selector, with: event)
    }
}
