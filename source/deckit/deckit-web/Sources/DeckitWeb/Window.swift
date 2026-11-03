//
//  Window.swift
//  DeckitWeb
//
//  Created by JSilver on 11/1/26.
//

import AppKit
import Quartz

// A window of the module's, which tells JavaScript what becomes of it: `resize` ({ width, height }, its content's
// size), `moving`, before the person moves it, `moved`, `key` and `resign`, as it takes and loses the keyboard, and
// `close`, once, as it closes. Its frame is in the screen's space as Electron's screen gives it: from the top left of
// the main display, in points.
@MainActor
final class Window: NSObject {
    // MARK: - Property
    // `titled`: macOS's title bar, its buttons and its title, above what the window shows, or over it where the buttons
    // are put. `floating`: no bar, over every app, on every Space and over one in full screen, taking the keyboard
    // without bringing the app forward.
    enum Kind: String {
        case titled
        case floating
    }

    let id: Int
    let window: NSWindow
    // Told once, as it closes, after JavaScript is.
    var ended: (() -> Void)?
    private let emitter: Emitter
    // Where the close button's top left is, from the window's top left.
    private let buttons: CGPoint?
    private var closed = false
    // What Quick Look's panel shows while the window controls it.
    private var preview: FilePreview?

    // MARK: - Initializer
    // `color` is laid under what the window shows; `material` blurs what is behind it instead. `showsTitle` draws the
    // title in the bar. A titled window with `buttons` shows its content under the bar too, the buttons where they
    // say; one without has the bar as macOS lays it.
    init(
        id: Int,
        kind: Kind,
        size: CGSize,
        title: String,
        showsTitle: Bool,
        color: NSColor?,
        material: NSVisualEffectView.Material?,
        buttons: CGPoint?,
        emitter: Emitter
    ) {
        let rect = CGRect(origin: .zero, size: size)
        switch kind {
        case .titled:
            let fullSize: NSWindow.StyleMask = buttons == nil ? [] : .fullSizeContentView
            window = KeyedWindow(
                contentRect: rect,
                styleMask: [.titled, .closable, .miniaturizable, .resizable, fullSize],
                backing: .buffered,
                defer: false
            )
            window.titleVisibility = showsTitle ? .visible : .hidden

        case .floating:
            let panel = KeyedPanel(
                contentRect: rect,
                styleMask: [.titled, .fullSizeContentView, .nonactivatingPanel],
                backing: .buffered,
                defer: false
            )
            panel.level = .floating
            panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            panel.hidesOnDeactivate = false
            panel.becomesKeyOnlyIfNeeded = false
            panel.titleVisibility = .hidden
            for button in [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton] {
                panel.standardWindowButton(button)?.isHidden = true
            }
            window = panel
        }
        self.id = id
        self.emitter = emitter
        self.buttons = kind == .titled ? buttons : nil
        super.init()
        window.isReleasedWhenClosed = false
        window.titlebarAppearsTransparent = true
        window.title = title
        window.tabbingMode = .disallowed
        window.contentView = Self.content(material: material)
        setColor(material == nil ? color : nil)
        window.center()
        window.delegate = self
        layButtons()
    }

    // MARK: - Lifecycle
    // Quick Look's panel is controlled by the window in front that accepts it, which hands it what it previews. AppKit
    // asks on the main thread.
    override nonisolated func acceptsPreviewPanelControl(_ panel: QLPreviewPanel!) -> Bool {
        MainActor.assumeIsolated { preview != nil }
    }

    override nonisolated func beginPreviewPanelControl(_ panel: QLPreviewPanel!) {
        MainActor.assumeIsolated { panel.dataSource = preview }
    }

    override nonisolated func endPreviewPanelControl(_ panel: QLPreviewPanel!) {
        MainActor.assumeIsolated {
            panel.dataSource = nil
            preview = nil
        }
    }

    // MARK: - Public
    var frame: CGRect {
        Self.flipped(window.frame)
    }

    var contentSize: CGSize {
        window.contentView?.bounds.size ?? .zero
    }

    // Brought forward and given the keyboard: a titled window brings the app forward, a floating one does not.
    func show(focus: Bool) {
        if window.isMiniaturized { window.deminiaturize(nil) }
        if focus {
            if !(window is NSPanel) { NSApp.activate(ignoringOtherApps: true) }
            window.makeKeyAndOrderFront(nil)
        } else {
            window.orderFront(nil)
        }
        layButtons()
    }

    func hide() {
        window.orderOut(nil)
    }

    func close() {
        window.close()
    }

    func setFrame(_ rect: CGRect) {
        window.setFrame(Self.flipped(rect), display: true)
    }

    // Its top left stays where it is.
    func setContentSize(_ size: CGSize) {
        let top = window.frame.maxY
        var frame = window.frameRect(forContentRect: CGRect(origin: window.frame.origin, size: size))
        frame.origin.y = top - frame.height
        window.setFrame(frame, display: true)
    }

    func setTitle(_ title: String) {
        window.title = title
        layButtons()
    }

    // A colour under what the window shows, or none; a window that blurs keeps its blur.
    func setColor(_ color: NSColor?) {
        guard !(window.contentView is NSVisualEffectView) else { return }
        window.isOpaque = color != nil
        window.backgroundColor = color ?? .clear
    }

    // `file` in Quick Look's panel, titled `title`, over the window.
    func previewFile(_ file: URL, title: String) {
        preview = FilePreview(file: file, title: title)
        guard let panel = QLPreviewPanel.shared() else { return }
        if panel.isVisible, panel.currentController as AnyObject? === self {
            panel.dataSource = preview
            panel.reloadData()
            return
        }
        panel.makeKeyAndOrderFront(nil)
    }

    // Quick Look's panel closed, where it shows what the window handed it.
    func closeFilePreview() {
        guard QLPreviewPanel.sharedPreviewPanelExists(), let panel = QLPreviewPanel.shared() else { return }
        if panel.currentController as AnyObject? === self { panel.close() }
    }

    // `panel` as a sheet on the window, answered once the person closes it.
    func runSheet(_ panel: NSSavePanel) async -> NSApplication.ModalResponse {
        await panel.beginSheetModal(for: window)
    }

    // What the person set a double click on a title bar to do.
    func doubleClickTitleBar() {
        switch UserDefaults.standard.string(forKey: "AppleActionOnDoubleClick") {
        case "Minimize":
            window.miniaturize(nil)

        case "None":
            break

        default:
            window.zoom(nil)
        }
    }

    // Moved by the person, from the press of the mouse that is under way.
    func drag(from press: NSEvent) {
        window.performDrag(with: press)
    }

    // MARK: - Private
    private static func content(material: NSVisualEffectView.Material?) -> NSView {
        guard let material else { return NSView() }
        let blur = NSVisualEffectView()
        blur.material = material
        blur.blendingMode = .behindWindow
        blur.state = .active

        return blur
    }

    // A screen rect in AppKit's space, from the main display's bottom left, in Electron's, from its top left, and back.
    private static func flipped(_ rect: CGRect) -> CGRect {
        let height = NSScreen.screens.first?.frame.height ?? 0

        return CGRect(x: rect.minX, y: height - rect.maxY, width: rect.width, height: rect.height)
    }

    // The buttons where they were asked for: the bar they sit in is as tall as their top's distance, both above and
    // below them, so they stay centred on it. AppKit lays the bar again as the window is shown, retitled or resized, so
    // this follows each.
    private func layButtons() {
        guard let buttons,
            let close = window.standardWindowButton(.closeButton),
            let minimize = window.standardWindowButton(.miniaturizeButton),
            let zoom = window.standardWindowButton(.zoomButton),
            let bar = close.superview?.superview
        else {
            return
        }

        let spacing = minimize.frame.minX - close.frame.minX
        let height = close.frame.height + buttons.y * 2
        bar.frame = CGRect(x: 0, y: window.frame.height - height, width: window.frame.width, height: height)
        for (index, button) in [close, minimize, zoom].enumerated() {
            button.setFrameOrigin(CGPoint(x: buttons.x + CGFloat(index) * spacing, y: buttons.y))
        }
    }
}

extension Window: NSWindowDelegate {
    // MARK: - Lifecycle
    func windowDidResize(_ notification: Notification) {
        layButtons()
        let size = contentSize
        emitter.emit("resize", ["width": Double(size.width), "height": Double(size.height)])
    }

    func windowWillMove(_ notification: Notification) {
        emitter.emit("moving")
    }

    func windowDidMove(_ notification: Notification) {
        emitter.emit("moved")
    }

    func windowDidBecomeKey(_ notification: Notification) {
        emitter.emit("key")
    }

    func windowDidResignKey(_ notification: Notification) {
        emitter.emit("resign")
    }

    func windowDidExitFullScreen(_ notification: Notification) {
        layButtons()
    }

    func windowWillClose(_ notification: Notification) {
        guard !closed else { return }
        closed = true
        emitter.emit("close")
        emitter.release()
        ended?()
    }
}

// Windows that hand the keyboard to a web page only as it may take it (WebPageView): asked before what has it now gives
// it up, so a page that may not leaves it where it is.
private final class KeyedWindow: NSWindow {
    override func makeFirstResponder(_ responder: NSResponder?) -> Bool {
        WebPageView.mayTake(responder) && super.makeFirstResponder(responder)
    }
}

private final class KeyedPanel: NSPanel {
    override func makeFirstResponder(_ responder: NSResponder?) -> Bool {
        WebPageView.mayTake(responder) && super.makeFirstResponder(responder)
    }
}
