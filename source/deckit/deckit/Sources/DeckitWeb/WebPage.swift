//
//  WebPage.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import WebKit
import CNodeAPI

// A web page on WebKit, laid where its mod's page shows it, which tells JavaScript what becomes of it and asks it what
// to do: `emit(event, payload)`. Told: `changed` (its state), `started`, `committed` ({ url }), `stopped`, `failed`
// ({ code, description, url }), `gone`, `focus`, `close` and `mouse` ({ type }). Asked, answered at once: `navigate` ({ url, followed }),
// "load" to let it, `open` ({ url, ownWindow }), and `key` ({ type, code, key, meta, control, alt, shift }), true for
// a key taken. Asked, answered later through `reply`: `permission` ({ origin, permissions, reply }).
@MainActor
final class WebPage: NSObject {
    // MARK: - Property
    let id: Int
    let view: WebPageView
    let host: WebPageHost
    private let emitter: Emitter
    private var observations: [NSKeyValueObservation] = []
    // Whether the next navigation is a load JavaScript asked for, which asked deck before: it is not asked again.
    private var asked = false

    // MARK: - Initializer
    // `store` names the data store the page keeps what sites store in, made on first use; none keeps nothing.
    init(id: Int, store: UUID?, applicationName: String, emitter: Emitter) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = store.map { WKWebsiteDataStore(forIdentifier: $0) } ?? .nonPersistent()
        configuration.applicationNameForUserAgent = applicationName
        configuration.preferences.isElementFullscreenEnabled = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        let view = WebPageView(frame: .zero, configuration: configuration)
        view.isInspectable = true
        self.id = id
        self.view = view
        self.host = WebPageHost(content: view)
        self.emitter = emitter
        super.init()
        view.navigationDelegate = self
        view.uiDelegate = self
        view.onFocus = { [weak self] in
            self?.emitter.emit("focus")
        }
        observe()
    }

    // MARK: - Public
    var state: [String: Any?] {
        [
            "url": view.url?.absoluteString ?? "",
            "title": view.title ?? "",
            "loading": view.isLoading,
            "canGoBack": view.canGoBack,
            "canGoForward": view.canGoForward,
            "camera": view.cameraCaptureState == .active,
            "microphone": view.microphoneCaptureState == .active
        ]
    }

    var isFocused: Bool {
        guard let window = view.window, window.isKeyWindow, let responder = window.firstResponder as? NSView else {
            return false
        }

        return responder.isDescendant(of: view)
    }

    func load(_ url: URL) {
        asked = true
        view.load(URLRequest(url: url))
    }

    func go(_ to: String) {
        switch to {
        case "back":
            view.goBack()

        case "forward":
            view.goForward()

        case "reload":
            view.reload()

        case "stop":
            view.stopLoading()

        default:
            break
        }
    }

    func focus() {
        view.window?.makeFirstResponder(view)
    }

    // Laid in `window`'s view tree, over the view that draws the mod's page, which is at `page` in the window's
    // content with `above` shown pages laid over it at that same rect, at `frame` in that page, both from their top
    // left. Where no view draws the page there, it stays over the one it was over, or else goes over the window's
    // content.
    func place(in window: NSView, page: CGRect, above: Int, frame: CGRect, holes: [Hole]) {
        guard let content = window.window?.contentView else {
            hide()
            return
        }

        let container = pageView(in: content, at: page, above: above) ?? host.superview ?? content
        if host.superview !== container {
            host.removeFromSuperview()
            container.addSubview(host)
        }
        host.frame = container.bounds
        let origin = container === content ? CGPoint(x: page.minX + frame.minX, y: page.minY + frame.minY) : frame.origin
        host.lay(CGRect(origin: origin, size: frame.size), holes: holes)
        host.isHidden = false
    }

    func hide() {
        host.isHidden = true
    }

    // What a key does, asked of JavaScript before the page has it.
    func pressed(_ event: NSEvent) -> Bool {
        let flags = event.modifierFlags
        let payload: [String: Any?] = [
            "type": event.type == .keyDown ? "keyDown" : "keyUp",
            "code": KeyCode(event.keyCode).name,
            "key": event.charactersIgnoringModifiers ?? "",
            "meta": flags.contains(.command),
            "control": flags.contains(.control),
            "alt": flags.contains(.option),
            "shift": flags.contains(.shift)
        ]

        return emitter.emit("key", payload) { node, value in try node.bool(value) } ?? false
    }

    func pointed(_ event: NSEvent) {
        emitter.emit("mouse", ["type": event.type == .leftMouseDown ? "mouseDown" : "mouseUp"])
    }

    // The value of `source`, a function body that may await, as JSON.
    func evaluate(_ source: String, done: @escaping @MainActor (Result<String, Error>) -> Void) {
        view.callAsyncJavaScript(
            "return JSON.stringify(await (async () => { \(source) })()) ?? 'null'",
            arguments: [:],
            in: nil,
            in: .page
        ) { result in
            MainActor.assumeIsolated {
                done(result.map { ($0 as? String) ?? "null" })
            }
        }
    }

    // What the page shows now, as a PNG.
    func snapshot(done: @escaping @MainActor (Result<Data, Error>) -> Void) {
        view.takeSnapshot(with: nil) { image, error in
            MainActor.assumeIsolated {
                guard let image, let tiff = image.tiffRepresentation,
                    let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:])
                else {
                    done(.failure(error ?? NodeError(message: "the page drew nothing")))
                    return
                }
                done(.success(png))
            }
        }
    }

    func close() {
        for observation in observations { observation.invalidate() }
        observations = []
        view.stopLoading()
        view.navigationDelegate = nil
        view.uiDelegate = nil
        view.onFocus = nil
        host.removeFromSuperview()
        emitter.release()
    }

    // MARK: - Private
    private func observe() {
        let told: @MainActor () -> Void = { [weak self] in
            guard let self else { return }
            emitter.emit("changed", state)
        }
        observations = [
            view.observe(\.url) { _, _ in MainActor.assumeIsolated { told() } },
            view.observe(\.title) { _, _ in MainActor.assumeIsolated { told() } },
            view.observe(\.isLoading) { _, _ in MainActor.assumeIsolated { told() } },
            view.observe(\.canGoBack) { _, _ in MainActor.assumeIsolated { told() } },
            view.observe(\.canGoForward) { _, _ in MainActor.assumeIsolated { told() } },
            view.observe(\.cameraCaptureState) { _, _ in MainActor.assumeIsolated { told() } },
            view.observe(\.microphoneCaptureState) { _, _ in MainActor.assumeIsolated { told() } }
        ]
    }

    // The view of Chromium's that draws a web contents at `rect` in the window's content, under `above` shown ones at
    // that rect: views are drawn in the order they are laid, so that is the mod's page.
    private func pageView(in content: NSView, at rect: CGRect, above: Int) -> NSView? {
        var found: [NSView] = []
        func search(_ view: NSView) {
            guard view !== host else { return }
            if String(describing: type(of: view)).contains("WebContentsViewCocoa") {
                let frame = view.convert(view.bounds, to: content)
                let top = content.isFlipped ? frame.minY : content.bounds.height - frame.maxY
                let placed = CGRect(x: frame.minX, y: top, width: frame.width, height: frame.height)
                if abs(placed.minX - rect.minX) < 1, abs(placed.minY - rect.minY) < 1,
                    abs(placed.width - rect.width) < 1, abs(placed.height - rect.height) < 1
                {
                    found.append(view)
                    return
                }
            }
            for subview in view.subviews { search(subview) }
        }
        search(content)

        let shown = found.filter { !$0.isHiddenOrHasHiddenAncestor }
        let index = shown.count - 1 - above

        return shown.indices.contains(index) ? shown[index] : nil
    }

    private func dialog(_ alert: NSAlert, done: @escaping @MainActor (NSApplication.ModalResponse) -> Void) {
        guard let window = view.window else {
            done(.cancel)
            return
        }
        alert.beginSheetModal(for: window) { response in
            MainActor.assumeIsolated { done(response) }
        }
    }
}

extension WebPage: WKNavigationDelegate {
    // MARK: - Lifecycle
    // A navigation of the page's own, a link or a script, is asked; one JavaScript asked for, history's, and a reload
    // are not, nor a frame's.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
    ) {
        let url = navigationAction.request.url
        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        let own = navigationAction.navigationType == .backForward || navigationAction.navigationType == .reload
        if isMainFrame, asked {
            asked = false
            decisionHandler(.allow)
            return
        }
        guard isMainFrame, !own, let url else {
            decisionHandler(.allow)
            return
        }

        let verdict: String? = emitter.emit("navigate", ["url": url.absoluteString, "followed": true]) { node, value in
            try node.string(value)
        }
        decisionHandler(verdict == "load" ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        emitter.emit("started")
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        emitter.emit("committed", ["url": webView.url?.absoluteString ?? ""])
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        emitter.emit("stopped")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failed(error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        failed(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        emitter.emit("gone")
    }

    // MARK: - Private
    private func failed(_ error: Error) {
        let error = error as NSError
        emitter.emit("failed", [
            "code": error.code,
            "description": error.localizedDescription,
            "url": (error.userInfo[NSURLErrorFailingURLStringErrorKey] as? String) ?? view.url?.absoluteString ?? ""
        ])
        emitter.emit("stopped")
    }
}

extension WebPage: WKUIDelegate {
    // MARK: - Lifecycle
    // A window the page asks for is JavaScript's to give; WebKit's own is never made.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        emitter.emit("open", [
            "url": navigationAction.request.url?.absoluteString ?? "",
            "ownWindow": windowFeatures.width != nil || windowFeatures.height != nil,
            "background": navigationAction.modifierFlags.contains(.command)
        ])

        return nil
    }

    func webViewDidClose(_ webView: WKWebView) {
        emitter.emit("close")
    }

    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void
    ) {
        let permissions: [String] = switch type {
        case .camera: ["camera"]
        case .microphone: ["microphone"]
        default: ["camera", "microphone"]
        }
        let port = origin.port == 0 ? "" : ":\(origin.port)"
        var answered = false
        let reply = Reply { node, arguments in
            guard !answered else { return }
            answered = true
            let granted = try arguments.first.map { try node.bool($0) } ?? false
            decisionHandler(granted ? .grant : .deny)
        }
        emitter.emit("permission", [
            "origin": "\(origin.protocol)://\(origin.host)\(port)",
            "permissions": permissions,
            "reply": reply
        ])
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable () -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        dialog(alert) { _ in completionHandler() }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (Bool) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        dialog(alert) { response in completionHandler(response == .alertFirstButtonReturn) }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (String?) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = prompt
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        let field = NSTextField(frame: CGRect(x: 0, y: 0, width: 260, height: 24))
        field.stringValue = defaultText ?? ""
        alert.accessoryView = field
        dialog(alert) { response in completionHandler(response == .alertFirstButtonReturn ? field.stringValue : nil) }
    }
}
