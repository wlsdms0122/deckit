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
// and goes no further unless the page answers at once that it did not take it.
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
    // The latest press of the mouse's button, in any window.
    private(set) var press: NSEvent?

    // MARK: - Initializer
    init(pageOf: @escaping @MainActor (NSView) -> WebPage?) {
        self.pageOf = pageOf
    }

    // MARK: - Public
    func start() {
        guard monitor == nil else { return }
        let events: NSEvent.EventTypeMask = [.keyDown, .keyUp, .leftMouseDown, .leftMouseUp]
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
        case .keyDown, .keyUp:
            if let page = handed.object(forKey: event) {
                handed.removeObject(forKey: event)
                return page.unhandled(event)
            }
            guard let responder = event.window?.firstResponder as? NSView, let page = pageOf(responder) else {
                return false
            }
            if page.pressed(event) { return true }
            if event.type == .keyDown { handed.setObject(page, forKey: event) }

            return false

        default:
            guard let content = event.window?.contentView,
                let view = content.hitTest(content.convert(event.locationInWindow, from: nil)),
                let page = pageOf(view)
            else {
                return false
            }
            page.pointed(event)

            return false
        }
    }

    // MARK: - Private
}
