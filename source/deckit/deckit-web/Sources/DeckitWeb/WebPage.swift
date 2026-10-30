//
//  WebPage.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import CryptoKit
import WebKit
import CNodeAPI

// A web page on WebKit, laid where its mod's page shows it, which tells JavaScript what becomes of it and asks it what
// to do: `emit(event, payload)`. Told: `adopted` ({ id }) first, then `changed` (its state), `started`, `committed`
// ({ url }), `stopped`, `failed` ({ code, description, url }), `gone`, `focus`, `close`, `mouse` ({ type }), `message`
// ({ body }), what deckit's own scripts post, and `external` ({ url }), an address of an app's the page asked to go to.
// Asked, answered at once: `navigate` ({ url }), "load" to let it; `open` ({ url, ownWindow, background }), a function
// to hear the page given for the window, or nothing for none; `key` ({ type, code, key, meta, control, alt, shift }),
// true for a key taken; and `certificate` ({ url, host, error, fingerprint, subject, issuer }), true for a certificate
// trusted though the Mac does not. Asked, answered later through `reply`: `permission` ({ origin, permissions,
// reply }).
@MainActor
final class WebPage: NSObject {
    // MARK: - Property
    // The world deckit's own scripts run in, apart from the page's, which sees none of them.
    static let deckitWorld = WKContentWorld.world(name: "deckit")
    private static let messages = "deckit"
    // What a page may go to itself; any other scheme is an app's.
    private static let webSchemes: Set<String> = ["http", "https", "about", "data", "blob", "file", "javascript"]

    let id: Int
    let view: WebPageView
    let host: WebPageHost
    private let emitter: Emitter
    private let adopt: @MainActor (WKWebViewConfiguration, Emitter) -> WebPage
    private var observations: [NSKeyValueObservation] = []
    // The address JavaScript asked to load, which asked deck before: its navigation is not asked again.
    private var requested: URL?

    // MARK: - Initializer
    // `configuration` is the page's, WebKit's own for a window a page opened. `adopt` makes the page for such a window.
    init(
        id: Int,
        configuration: WKWebViewConfiguration,
        emitter: Emitter,
        adopt: @escaping @MainActor (WKWebViewConfiguration, Emitter) -> WebPage
    ) {
        // A window's configuration is its opener's copy, whose scripts and handlers are the opener's.
        configuration.userContentController = WKUserContentController()
        configuration.preferences.isElementFullscreenEnabled = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        let view = WebPageView(frame: .zero, configuration: configuration)
        view.isInspectable = true
        self.id = id
        self.view = view
        self.host = WebPageHost(content: view)
        self.emitter = emitter
        self.adopt = adopt
        super.init()
        configuration.userContentController.add(
            MessageRelay(to: self),
            contentWorld: Self.deckitWorld,
            name: Self.messages
        )
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
            "microphone": view.microphoneCaptureState == .active,
            "store": view.configuration.websiteDataStore.identifier?.uuidString.lowercased()
        ]
    }

    var isFocused: Bool {
        guard let window = view.window, window.isKeyWindow, let responder = window.firstResponder as? NSView else {
            return false
        }

        return responder.isDescendant(of: view)
    }

    // Told once the page is the module's, so JavaScript knows it by its id before anything else.
    func announce() {
        emitter.emit("adopted", ["id": id])
    }

    func load(_ url: URL) {
        requested = url
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

    // The scripts every document of the page runs as it starts, in place of those it had.
    func run(_ scripts: [UserScript]) {
        let controller = view.configuration.userContentController
        controller.removeAllUserScripts()
        for script in scripts {
            controller.addUserScript(WKUserScript(
                source: script.source,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: script.mainFrameOnly,
                in: script.world == .page ? .page : Self.deckitWorld
            ))
        }
    }

    // Laid in `window`'s view tree, over the view that draws the mod's page, which is at `page` in the window's
    // content with `above` shown pages laid over it at that same rect, at `frame` in that page, both from their top
    // left. Where no view draws the page there, it stays over the one it was over, or else goes over the window's
    // content.
    func place(in window: NSView, page: CGRect, above: Int, frame: CGRect) {
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
        host.autoresizingMask = [.width, .height]
        let origin = container === content
            ? CGPoint(x: page.minX + frame.minX, y: page.minY + frame.minY)
            : frame.origin
        host.lay(CGRect(origin: origin, size: frame.size))
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

    // The value of `source`, a function body that may await, as JSON, run in the page's world or deckit's.
    func evaluate(
        _ source: String,
        in world: UserScript.World,
        done: @escaping @MainActor (Result<String, Error>) -> Void
    ) {
        view.callAsyncJavaScript(
            "return JSON.stringify(await (async () => { \(source) })()) ?? 'null'",
            arguments: [:],
            in: nil,
            in: world == .page ? .page : Self.deckitWorld
        ) { result in
            MainActor.assumeIsolated {
                done(result.map { ($0 as? String) ?? "null" })
            }
        }
    }

    // The next match of `text`, or the one before, selected and shown: whether there is one.
    func find(_ text: String, backwards: Bool, caseSensitive: Bool, done: @escaping @MainActor (Bool) -> Void) {
        let configuration = WKFindConfiguration()
        configuration.backwards = backwards
        configuration.caseSensitive = caseSensitive
        configuration.wraps = true
        view.find(text, configuration: configuration) { result in
            MainActor.assumeIsolated { done(result.matchFound) }
        }
    }

    func close() {
        for observation in observations { observation.invalidate() }
        observations = []
        view.stopLoading()
        view.configuration.userContentController.removeAllScriptMessageHandlers()
        view.navigationDelegate = nil
        view.uiDelegate = nil
        view.onFocus = nil
        host.removeFromSuperview()
        emitter.release()
    }

    // What deckit's scripts post, as text.
    func received(_ body: Any) {
        guard let text = body as? String else { return }
        emitter.emit("message", ["body": text])
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

    private func failed(_ error: Error) {
        let error = error as NSError
        emitter.emit("failed", [
            "code": error.code,
            "description": error.localizedDescription,
            "url": (error.userInfo[NSURLErrorFailingURLStringErrorKey] as? String) ?? view.url?.absoluteString ?? ""
        ])
        emitter.emit("stopped")
    }

    // A certificate the Mac does not trust, as the page's tab is told of it.
    private func refusal(of trust: SecTrust, error: CFError?, host: String) -> [String: Any?] {
        let chain = (SecTrustCopyCertificateChain(trust) as? [SecCertificate]) ?? []
        let leaf = chain.first
        let data = leaf.map { SecCertificateCopyData($0) as Data } ?? Data()
        let issuer = chain.count > 1 ? SecCertificateCopySubjectSummary(chain[1]) as String? : nil

        return [
            "url": view.url?.absoluteString ?? "https://\(host)/",
            "host": host,
            "error": error.map { CFErrorCopyDescription($0) as String } ?? "the certificate is not trusted",
            "fingerprint": "sha256/" + Data(SHA256.hash(data: data)).base64EncodedString(),
            "subject": leaf.flatMap { SecCertificateCopySubjectSummary($0) as String? } ?? host,
            "issuer": issuer ?? ""
        ]
    }
}

extension WebPage: WKNavigationDelegate {
    // MARK: - Lifecycle
    // A navigation of the page's own, a link or a script, is asked; one JavaScript asked for, history's, and a reload
    // are not, nor a frame's, nor one in a window the page opens, which is asked as the window (`open`). An app's
    // address goes to the app, as JavaScript lets it, and the page stays.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
    ) {
        let own = navigationAction.navigationType == .backForward || navigationAction.navigationType == .reload
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        if let scheme = url.scheme?.lowercased(), !Self.webSchemes.contains(scheme) {
            decisionHandler(.cancel)
            emitter.emit("external", ["url": url.absoluteString])
            return
        }
        guard let target = navigationAction.targetFrame else {
            decisionHandler(.allow)
            return
        }
        if target.isMainFrame, let requested, requested.absoluteString == url.absoluteString {
            self.requested = nil
            decisionHandler(.allow)
            return
        }
        guard target.isMainFrame, !own else {
            decisionHandler(.allow)
            return
        }

        let verdict: String? = emitter.emit("navigate", ["url": url.absoluteString]) { node, value in
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

    // A server the Mac does not trust is let through only where JavaScript says its certificate was trusted.
    func webView(
        _ webView: WKWebView,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping @MainActor @Sendable (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
            let trust = challenge.protectionSpace.serverTrust
        else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        var error: CFError?
        if SecTrustEvaluateWithError(trust, &error) {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        let refusal = refusal(of: trust, error: error, host: challenge.protectionSpace.host)
        let trusted = emitter.emit("certificate", refusal) { node, value in try node.bool(value) } ?? false
        if trusted {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}

extension WebPage: WKUIDelegate {
    // MARK: - Lifecycle
    // A window the page asks for is JavaScript's to give, as a page of the module's with WebKit's configuration for
    // it, which keeps its opener.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        let payload: [String: Any?] = [
            "url": navigationAction.request.url?.absoluteString ?? "",
            "ownWindow": windowFeatures.width != nil || windowFeatures.height != nil,
            "background": navigationAction.modifierFlags.contains(.command),
            "width": windowFeatures.width?.doubleValue,
            "height": windowFeatures.height?.doubleValue
        ]
        let heard: Emitter? = emitter.emit("open", payload) { node, value in
            var type = napi_undefined
            napi_typeof(node.environment, value, &type)

            return type == napi_function ? try Emitter(node: node, function: value) : nil
        }
        guard let heard else { return nil }
        let page = adopt(configuration, heard)
        // Its first load is the window deck was asked for.
        page.requested = navigationAction.request.url
        page.announce()

        return page.view
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
