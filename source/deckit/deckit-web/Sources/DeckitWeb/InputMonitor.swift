//
//  InputMonitor.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit

// What a person does to a web page, handed to that page before WebKit has it: a key pressed while the page has the
// keyboard, which goes no further when the page answers it took it, and a press of the mouse in it. A key down the
// document did not handle WebKit sends to the app again, the same event, which is handed to its page as unhandled,
// and goes no further unless the page answers at once that it did not take it. One put into a page for a seat
// (WebPage+Input) is handed to that page as unhandled with its source and never goes further, so it does not
// reach what has the window's keyboard. Every event of the machine's pointer and keyboard is told to each of
// `listeners` too, in a page's own terms (Put), with the page it is delivered to.
@MainActor
final class InputMonitor {
    // MARK: - Property
    private let pageOf: @MainActor (NSView) -> WebPage?
    private var monitor: Any?
    // Each key down handed to a page, to that page, while the event lives.
    private let handed = NSMapTable<NSEvent, WebPage>(
        keyOptions: [.weakMemory, .objectPointerPersonality],
        valueOptions: .weakMemory
    )
    // Each key down put into a page for a seat, to that page and its source, while the event lives.
    private let put = NSMapTable<NSEvent, PutKey>(
        keyOptions: [.weakMemory, .objectPointerPersonality],
        valueOptions: .strongMemory
    )
    // The latest press of the mouse's button, in any window.
    private(set) var press: NSEvent?
    // What hears the machine's input, each `emit("input", event)`.
    var listeners: [Emitter] = []
    private weak var pressed: WebPage? // the page a button of the machine's pointer is held in

    // MARK: - Initializer
    init(pageOf: @escaping @MainActor (NSView) -> WebPage?) {
        self.pageOf = pageOf
    }

    // MARK: - Public
    func start() {
        guard monitor == nil else { return }
        let events: NSEvent.EventTypeMask = [
            .keyDown, .keyUp, .flagsChanged, .leftMouseDown, .leftMouseUp, .rightMouseDown, .rightMouseUp,
            .otherMouseDown, .otherMouseUp, .mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged,
            .scrollWheel
        ]
        monitor = NSEvent.addLocalMonitorForEvents(matching: events) { event in
            var passed: NSEvent? = event
            MainActor.assumeIsolated {
                if self.took(event) { passed = nil }
            }

            return passed
        }
    }

    // `event` handed to the page it is for, as the app gets it: whether the page took it, so it goes no further.
    func took(_ event: NSEvent) -> Bool {
        if event.type == .leftMouseDown { press = event }
        switch event.type {
        case .keyDown, .keyUp, .flagsChanged:
            if let key = put.object(forKey: event) {
                put.removeObject(forKey: event)
                _ = key.page?.unhandled(event, source: key.source)
                return true
            }
            if let page = handed.object(forKey: event) {
                handed.removeObject(forKey: event)
                return page.unhandled(event)
            }
            let page = (event.window?.firstResponder as? NSView).flatMap(pageOf)
            tell(key: event, in: page)
            guard let page, event.type != .flagsChanged else { return false }
            if page.pressed(event) { return true }
            if event.type == .keyDown { handed.setObject(page, forKey: event) }

            return false

        default:
            let presses: [NSEvent.EventType] = [
                .leftMouseDown, .leftMouseUp, .rightMouseDown, .rightMouseUp, .otherMouseDown, .otherMouseUp
            ]
            guard !listeners.isEmpty || presses.contains(event.type) else { return false }
            let under = event.window?.contentView.flatMap { content in
                content.hitTest(content.convert(event.locationInWindow, from: nil)).flatMap(pageOf)
            }
            tell(pointer: event, in: under)
            if event.type == .leftMouseDown || event.type == .leftMouseUp { under?.pointed(event) }

            return false
        }
    }

    // A key down put into `page` for what `source` names, known when WebKit sends it to the app again.
    func putting(_ event: NSEvent, into page: WebPage, source: String) {
        put.setObject(PutKey(page: page, source: source), forKey: event)
    }

    // MARK: - Private
    private func tell(key event: NSEvent, in page: WebPage?) {
        guard !listeners.isEmpty else { return }
        let code = KeyCode(event.keyCode)
        var payload: [String: Any?] = [
            "event": "key",
            "code": code.name,
            "modifiers": Put.names(of: event.modifierFlags),
            "page": page?.id
        ]
        if event.type == .flagsChanged {
            let flag = Put.modifierKeys[code.name] ?? []
            payload["type"] = event.modifierFlags.contains(flag) && !flag.isEmpty ? "down" : "up"
            payload["key"] = Put.modifiers.first { $0.flag == flag }.map { $0.name.capitalized } ?? "Unidentified"
            payload["repeat"] = false
        } else {
            payload["type"] = event.type == .keyDown ? "down" : "up"
            payload["key"] = WebPage.key(typing: event.characters ?? "")
            payload["repeat"] = event.isARepeat
        }
        listeners.forEach { $0.emit("input", payload) }
    }

    // A move with a button held and the let go that ends it are the page's the button went down in.
    private func tell(pointer event: NSEvent, in under: WebPage?) {
        let downs: [NSEvent.EventType] = [.leftMouseDown, .rightMouseDown, .otherMouseDown]
        let ups: [NSEvent.EventType] = [.leftMouseUp, .rightMouseUp, .otherMouseUp]
        let drags: [NSEvent.EventType] = [.leftMouseDragged, .rightMouseDragged, .otherMouseDragged]
        if downs.contains(event.type), pressed == nil { pressed = under }
        let page = drags.contains(event.type) || ups.contains(event.type) ? pressed ?? under : under
        if ups.contains(event.type) { pressed = nil }
        guard !listeners.isEmpty else { return }
        // The buttons held once the event is: the system may say them as they were before it.
        var held = NSEvent.pressedMouseButtons
        let button = [0, 2, 1][min(event.buttonNumber, 2)]
        if downs.contains(event.type) { held |= Put.bit(of: button) }
        if ups.contains(event.type) { held &= ~Put.bit(of: button) }
        var payload: [String: Any?] = [
            "event": "pointer",
            "buttons": Put.buttons(of: held),
            "modifiers": Put.names(of: event.modifierFlags),
            "page": page?.id
        ]
        if let page {
            let point = page.view.convert(event.locationInWindow, from: nil)
            payload["x"] = Double(point.x)
            payload["y"] = Double(point.y)
        } else if let content = event.window?.contentView {
            let point = content.convert(event.locationInWindow, from: nil)
            payload["x"] = Double(point.x)
            payload["y"] = Double(content.isFlipped ? point.y : content.bounds.height - point.y)
        }
        if downs.contains(event.type) || ups.contains(event.type) {
            payload["type"] = downs.contains(event.type) ? "down" : "up"
            payload["button"] = button
            payload["count"] = event.clickCount
        } else if event.type == .scrollWheel {
            payload["type"] = "scroll"
            payload["dx"] = Double(-event.scrollingDeltaX)
            payload["dy"] = Double(-event.scrollingDeltaY)
        } else {
            payload["type"] = "move"
        }
        listeners.forEach { $0.emit("input", payload) }
    }
}

// A page a key was put into and the source it was put for.
private final class PutKey {
    // MARK: - Property
    weak var page: WebPage?
    let source: String

    // MARK: - Initializer
    init(page: WebPage, source: String) {
        self.page = page
        self.source = source
    }
}
