//
//  WebPage+Input.swift
//  DeckitWeb
//
//  Created by JSilver on 11/1/26.
//

import AppKit
import ObjectiveC

// Input made for the page as a person's would come: each event is handed to `input` as the app hands it one, and goes
// on to the page unless a page took it there. It reaches the page whether or not the app is the active one. And input
// put into the page for a seat that is not the machine's (`put`): straight to the page's view, which is not given the
// keyboard, and never through the window, so what has the window's keyboard and the order of its views stay.
extension WebPage {
    // MARK: - Public
    // The key at `code` pressed and let go, typing `key`, as the web names both, with `modifiers` held, the page given
    // the keyboard first.
    func sendKey(_ code: KeyCode, key: String, modifiers: NSEvent.ModifierFlags, through input: InputMonitor) throws {
        let window = try shownWindow()
        view.take()
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

    // The mouse's button pressed (`leftMouseDown`), the page given the keyboard first as its window gives a press,
    // unless its keyboard is reserved, moved held (`leftMouseDragged`) or let go (`leftMouseUp`) at `point`, from the
    // page's top left, or the mouse moved there (`mouseMoved`), which its window hands on.
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
            HeldButtons.hold(true)
            if !view.isReserved { view.take() }
            view.mouseDown(with: event)

        case .leftMouseDragged:
            view.mouseDragged(with: event)

        case .mouseMoved:
            window.sendEvent(event)

        default:
            HeldButtons.hold(false)
            view.mouseUp(with: event)
        }
    }

    // An event of the app's own that carries nothing: the app ends the undo step of the edits before it, as it does
    // at each event of the machine's devices.
    private static func step() {
        guard let event = NSEvent.otherEvent(
            with: .applicationDefined, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: 0, context: nil, subtype: 0, data1: 0, data2: 0
        ) else { return }
        NSApp.postEvent(event, atStart: false)
    }

    // `event` put into the page for what `source` names: what the page tells of it carries `source`, and a key the
    // document does not handle is handed back to this page alone (InputMonitor).
    func put(_ event: Put, source: String, through input: InputMonitor) throws {
        let window = try shownWindow()
        Self.step()
        switch event {
        case let .pointer(pointer):
            try put(pointer, source: source, in: window)

        case let .key(key):
            let modifier = Put.modifierKeys[key.code.name]
            let type: NSEvent.EventType = modifier != nil ? .flagsChanged : key.isDown ? .keyDown : .keyUp
            let characters = modifier != nil ? "" : Self.characters[key.key] ?? key.key
            var flags = key.modifiers
            if let modifier { if key.isDown { flags.insert(modifier) } else { flags.remove(modifier) } }
            guard let made = NSEvent.keyEvent(
                with: type,
                location: .zero,
                modifierFlags: flags,
                timestamp: ProcessInfo.processInfo.systemUptime,
                windowNumber: window.windowNumber,
                context: nil,
                characters: characters,
                charactersIgnoringModifiers: characters,
                isARepeat: key.isRepeat,
                keyCode: key.code.value
            ) else {
                throw NodeError(message: "no event of the key")
            }
            switch type {
            case .flagsChanged:
                view.flagsChanged(with: made)

            case .keyDown:
                guard !pressed(made, source: source) else { return }
                input.putting(made, into: self, source: source)
                view.keyDown(with: made)

            default:
                guard !pressed(made, source: source) else { return }
                view.keyUp(with: made)
            }

        case let .paste(text):
            paste(text)

        case let .text(text):
            guard let client = view as AnyObject as? NSTextInputClient else {
                throw NodeError(message: "the page takes no text")
            }
            let none = NSRange(location: NSNotFound, length: 0)
            switch text {
            case let .insert(text):
                client.insertText(text, replacementRange: none)

            case let .compose(text):
                let end = NSRange(location: (text as NSString).length, length: 0)
                client.setMarkedText(text, selectedRange: end, replacementRange: none)

            case .commit:
                client.unmarkText()

            case .cancel:
                client.setMarkedText("", selectedRange: NSRange(location: 0, length: 0), replacementRange: none)
                client.unmarkText()
            }
        }
    }

    // What a key that types `characters` is named, as the web names it.
    static func key(typing characters: String) -> String {
        Self.characters.first { $0.value == characters }?.key ?? characters
    }

    // `files` dragged in from outside the app and dropped at `point`, from the page's top left, each by reference as
    // the system's file browser drags it: dragged over the page first, and dropped once the page has had `settle` to
    // answer the drag.
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

    // The buttons the seat holds are the system's while its event is made into the page's, and no other seat's: the
    // page's event is made before the view answers (WebPageView.put).
    private func put(_ pointer: Put.Pointer, source: String, in window: NSWindow) throws {
        let held = HeldButtons.held(by: source) { held in
            if let buttons = pointer.buttons {
                held = buttons.reduce(0) { $0 | Put.bit(of: $1) }
            } else if pointer.kind == .down {
                held |= Put.bit(of: pointer.button)
            } else if pointer.kind == .up {
                held &= ~Put.bit(of: pointer.button)
            }
        }
        let location = view.convert(pointer.point, to: nil)
        if pointer.kind == .scroll {
            let made = try Self.scroll(by: pointer.delta, at: location, modifiers: pointer.modifiers, in: window)
            return HeldButtons.while(held) { view.scrollWheel(with: made) }
        }
        let side = pointer.kind == .move ? (held & 1 != 0 ? 0 : held & 2 != 0 ? 2 : 1) : pointer.button
        let type: NSEvent.EventType = switch (pointer.kind, side) {
        case (.down, 0): .leftMouseDown
        case (.down, 2): .rightMouseDown
        case (.down, _): .otherMouseDown
        case (.up, 0): .leftMouseUp
        case (.up, 2): .rightMouseUp
        case (.up, _): .otherMouseUp
        case (_, 0) where held != 0: .leftMouseDragged
        case (_, 2) where held != 0: .rightMouseDragged
        case (_, _) where held != 0: .otherMouseDragged
        default: .mouseMoved
        }
        guard let made = NSEvent.mouseEvent(
            with: type,
            location: location,
            modifierFlags: pointer.modifiers,
            timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: window.windowNumber,
            context: nil,
            eventNumber: 0,
            clickCount: pointer.kind == .move ? 0 : max(pointer.count, 1),
            pressure: pointer.kind == .down || (pointer.kind == .move && held != 0) ? 1 : 0
        ) else {
            throw NodeError(message: "no event of the pointer")
        }
        if type == .leftMouseDown || type == .leftMouseUp { pointed(made, source: source) }
        HeldButtons.while(held) {
            view.put {
                switch type {
                case .leftMouseDown: view.mouseDown(with: made)
                case .rightMouseDown: view.rightMouseDown(with: made)
                case .otherMouseDown: view.otherMouseDown(with: made)
                case .leftMouseUp: view.mouseUp(with: made)
                case .rightMouseUp: view.rightMouseUp(with: made)
                case .otherMouseUp: view.otherMouseUp(with: made)
                case .leftMouseDragged: view.mouseDragged(with: made)
                case .rightMouseDragged: view.rightMouseDragged(with: made)
                case .otherMouseDragged: view.otherMouseDragged(with: made)
                default: view.moved(put: made)
                }
            }
        }
    }

    // A turn of the wheel by `delta` points at `location` in `window`. An event made of one the system would send has
    // no window, so its place in the window is read as the screen's and given as such.
    private static func scroll(
        by delta: CGVector,
        at location: CGPoint,
        modifiers: NSEvent.ModifierFlags,
        in window: NSWindow
    ) throws -> NSEvent {
        guard let made = CGEvent(
            scrollWheelEvent2Source: nil,
            units: .pixel,
            wheelCount: 2,
            wheel1: Int32(-delta.dy),
            wheel2: Int32(-delta.dx),
            wheel3: 0
        ) else {
            throw NodeError(message: "no event of the scroll")
        }
        made.location = CGPoint(x: location.x, y: (NSScreen.screens.first?.frame.height ?? 0) - location.y)
        made.flags = CGEventFlags(rawValue: UInt64(modifiers.rawValue))
        made.setIntegerValueField(.mouseEventWindowUnderMousePointer, value: Int64(window.windowNumber))
        made.setIntegerValueField(
            .mouseEventWindowUnderMousePointerThatCanHandleThisEvent,
            value: Int64(window.windowNumber)
        )
        guard let event = NSEvent(cgEvent: made) else { throw NodeError(message: "no event of the scroll") }

        return event
    }

    private func shownWindow() throws -> NSWindow {
        guard let window = view.window, !view.isHiddenOrHasHiddenAncestor else {
            throw NodeError(message: "a page off screen takes no input")
        }

        return window
    }
}

// The mouse's buttons held in the input made here, which WebKit reads with the system's buttons
// (`NSEvent.pressedMouseButtons`) as it makes a page's pointer events: the left one held as the machine's would be,
// beside the system's own, and those each seat holds, by its source, answered alone while an event of that seat is made
// into a page's.
enum HeldButtons {
    // MARK: - Property
    nonisolated(unsafe) private static var machine = 0
    nonisolated(unsafe) private static var seats: [String: Int] = [:]
    nonisolated(unsafe) private static var putting: Int?
    private static let answered: Void = {
        let selector = #selector(getter: NSEvent.pressedMouseButtons)
        guard let method = class_getClassMethod(NSEvent.self, selector) else { return }

        typealias Getter = @convention(c) (AnyClass, Selector) -> Int
        let system = unsafeBitCast(method_getImplementation(method), to: Getter.self)
        let pressed: @convention(block) (AnyClass) -> Int = { type in putting ?? (system(type, selector) | machine) }
        method_setImplementation(method, imp_implementationWithBlock(pressed))
    }()

    // MARK: - Public
    static func hold(_ on: Bool) {
        _ = answered
        machine = on ? 1 : 0
    }

    // The buttons `seat` holds once `change` is made to them.
    static func held(by seat: String, _ change: (inout Int) -> Void) -> Int {
        var held = seats[seat] ?? 0
        change(&held)
        seats[seat] = held == 0 ? nil : held

        return held
    }

    // `work` done while the system's buttons are answered as `buttons`.
    static func `while`(_ buttons: Int, _ work: () -> Void) {
        _ = answered
        putting = buttons
        defer { putting = nil }
        work()
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
