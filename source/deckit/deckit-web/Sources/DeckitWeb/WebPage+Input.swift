//
//  WebPage+Input.swift
//  DeckitWeb
//
//  Created by JSilver on 11/1/26.
//

import AppKit

// Input made for the page as a person's would come: each event is handed to `input` as the app hands it one, and goes
// on to the page unless a page took it there. It reaches the page whether or not the app is the active one.
extension WebPage {
    // MARK: - Public
    // The key at `code` pressed and let go, typing `key`, as the web names both, with `modifiers` held, the page given
    // the keyboard first.
    func sendKey(_ code: KeyCode, key: String, modifiers: NSEvent.ModifierFlags, through input: InputMonitor) throws {
        let window = try shownWindow()
        window.makeFirstResponder(view)
        let characters = Self.characters[key] ?? key
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            guard let event = NSEvent.keyEvent(
                with: type,
                location: .zero,
                modifierFlags: modifiers,
                timestamp: ProcessInfo.processInfo.systemUptime,
                windowNumber: window.windowNumber,
                context: nil,
                characters: characters,
                charactersIgnoringModifiers: characters,
                isARepeat: false,
                keyCode: code.value
            ), !input.took(event) else {
                continue
            }
            if type == .keyDown { view.keyDown(with: event) } else { view.keyUp(with: event) }
        }
    }

    // The mouse's button pressed (`leftMouseDown`), moved held (`leftMouseDragged`) or let go (`leftMouseUp`) at
    // `point`, from the page's top left.
    func sendMouse(_ type: NSEvent.EventType, at point: CGPoint, through input: InputMonitor) throws {
        let window = try shownWindow()
        guard let event = NSEvent.mouseEvent(
            with: type,
            location: view.convert(point, to: nil),
            modifierFlags: [],
            timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: window.windowNumber,
            context: nil,
            eventNumber: 0,
            clickCount: 1,
            pressure: type == .leftMouseUp ? 0 : 1
        ), !input.took(event) else {
            return
        }
        switch type {
        case .leftMouseDown:
            view.mouseDown(with: event)

        case .leftMouseDragged:
            view.mouseDragged(with: event)

        default:
            view.mouseUp(with: event)
        }
    }

    // MARK: - Private
    // What a key the web names by a word types, as AppKit's events carry it.
    private static let characters: [String: String] = [
        "Enter": "\r",
        "Tab": "\t",
        "Escape": "\u{1B}",
        "Backspace": "\u{7F}",
        "ArrowUp": String(UnicodeScalar(NSUpArrowFunctionKey)!),
        "ArrowDown": String(UnicodeScalar(NSDownArrowFunctionKey)!),
        "ArrowLeft": String(UnicodeScalar(NSLeftArrowFunctionKey)!),
        "ArrowRight": String(UnicodeScalar(NSRightArrowFunctionKey)!),
        "Delete": String(UnicodeScalar(NSDeleteFunctionKey)!),
        "Home": String(UnicodeScalar(NSHomeFunctionKey)!),
        "End": String(UnicodeScalar(NSEndFunctionKey)!),
        "PageUp": String(UnicodeScalar(NSPageUpFunctionKey)!),
        "PageDown": String(UnicodeScalar(NSPageDownFunctionKey)!)
    ]

    private func shownWindow() throws -> NSWindow {
        guard let window = view.window else { throw NodeError(message: "a page off screen takes no input") }

        return window
    }
}
