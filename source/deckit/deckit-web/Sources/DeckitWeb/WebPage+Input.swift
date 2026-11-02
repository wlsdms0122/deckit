//
//  WebPage+Input.swift
//  DeckitWeb
//
//  Created by JSilver on 11/1/26.
//

import AppKit
import ObjectiveC

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
    // `point`, from the page's top left, or the mouse moved there (`mouseMoved`), which its window hands on.
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
            pressure: type == .leftMouseDown || type == .leftMouseDragged ? 1 : 0
        ), !input.took(event) else {
            return
        }
        switch type {
        case .leftMouseDown:
            HeldButton.hold(true)
            view.mouseDown(with: event)

        case .leftMouseDragged:
            view.mouseDragged(with: event)

        case .mouseMoved:
            window.sendEvent(event)

        default:
            HeldButton.hold(false)
            view.mouseUp(with: event)
        }
    }

    // `files` dragged in from outside the app and dropped at `point`, from the page's top left, each by reference as
    // Finder drags it: dragged over the page first, and dropped once the page has had `settle` to answer the drag.
    func sendDrop(_ files: [URL], at point: CGPoint, settle: Duration = .milliseconds(300)) async throws {
        let window = try shownWindow()
        let pasteboard = NSPasteboard.withUniqueName()
        pasteboard.writeObjects(files.map { ($0 as NSURL).fileReferenceURL() as NSURL? ?? $0 as NSURL })
        let drag = Drag(window: window, location: view.convert(point, to: nil), pasteboard: pasteboard)
        _ = view.draggingEntered(drag)
        _ = view.draggingUpdated(drag)
        try await Task.sleep(for: settle)
        _ = view.draggingUpdated(drag)
        try await Task.sleep(for: settle)
        if view.prepareForDragOperation(drag) { _ = view.performDragOperation(drag) }
        view.concludeDragOperation(drag)
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
        guard let window = view.window, !view.isHiddenOrHasHiddenAncestor else {
            throw NodeError(message: "a page off screen takes no input")
        }

        return window
    }
}

// The mouse's left button held in the input made here, which WebKit reads with the system's buttons
// (`NSEvent.pressedMouseButtons`) as it makes a page's pointer events.
private enum HeldButton {
    // MARK: - Property
    nonisolated(unsafe) private static var held = false
    private static let answered: Void = {
        let selector = #selector(getter: NSEvent.pressedMouseButtons)
        guard let method = class_getClassMethod(NSEvent.self, selector) else { return }

        typealias Getter = @convention(c) (AnyClass, Selector) -> Int
        let system = unsafeBitCast(method_getImplementation(method), to: Getter.self)
        let pressed: @convention(block) (AnyClass) -> Int = { type in system(type, selector) | (held ? 1 : 0) }
        method_setImplementation(method, imp_implementationWithBlock(pressed))
    }()

    // MARK: - Public
    static func hold(_ on: Bool) {
        _ = answered
        held = on
    }
}

// A drag of files from outside the app over a window, as AppKit hands a destination one.
nonisolated private final class Drag: NSObject, NSDraggingInfo {
    // MARK: - Property
    let draggingDestinationWindow: NSWindow?
    let draggingLocation: NSPoint
    let draggingPasteboard: NSPasteboard
    var draggingSourceOperationMask: NSDragOperation { .copy }
    var draggedImageLocation: NSPoint { draggingLocation }
    var draggedImage: NSImage? { nil }
    var draggingSource: Any? { nil }
    var draggingSequenceNumber: Int { 1 }
    var draggingFormation: NSDraggingFormation = .default
    var animatesToDestination = false
    var numberOfValidItemsForDrop = 0
    var springLoadingHighlight: NSSpringLoadingHighlight { .none }

    // MARK: - Initializer
    init(window: NSWindow, location: NSPoint, pasteboard: NSPasteboard) {
        draggingDestinationWindow = window
        draggingLocation = location
        draggingPasteboard = pasteboard
    }

    // MARK: - Public
    func slideDraggedImage(to screenPoint: NSPoint) {}

    func enumerateDraggingItems(
        options enumOpts: NSDraggingItemEnumerationOptions = [],
        for view: NSView?,
        classes classArray: [AnyClass],
        searchOptions: [NSPasteboard.ReadingOptionKey: Any] = [:],
        using block: (NSDraggingItem, Int, UnsafeMutablePointer<ObjCBool>) -> Void
    ) {}

    func resetSpringLoading() {}
}
