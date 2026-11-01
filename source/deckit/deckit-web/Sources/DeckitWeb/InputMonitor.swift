//
//  InputMonitor.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit

// What a person does to a web page, handed to that page before WebKit has it: a key pressed while the page has the
// keyboard, which goes no further when the page answers it took it, and a press of the mouse in it.
@MainActor
final class InputMonitor {
    // MARK: - Property
    private let pageOf: @MainActor (NSView) -> WebPage?
    private var monitor: Any?
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

    // MARK: - Private
    private func took(_ event: NSEvent) -> Bool {
        if event.type == .leftMouseDown { press = event }
        switch event.type {
        case .keyDown, .keyUp:
            guard let responder = event.window?.firstResponder as? NSView, let page = pageOf(responder) else {
                return false
            }

            return page.pressed(event)

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
}
