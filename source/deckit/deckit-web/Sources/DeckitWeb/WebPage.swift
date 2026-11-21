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

// A page on WebKit, laid on a stage, which tells JavaScript what becomes of it and asks it what to do: `emit(event,
// payload)`. Told: `adopted` ({ id }) first, then `changed` (its state), `started`, `committed` ({ url }), `stopped`,
// `failed` ({ code, description, url }), `gone`, `focus`, `close`, `mouse` ({ type }), `message` ({ body, origin, main,
// evaluate, answer }), what deckit's own scripts post in a frame (received), and `external` ({ url, origin }), an
// address of an app's the page asked to go to. Asked, answered at once: `navigate` ({ url }), "load" to let it; `open`
// ({ url, ownWindow, background, width, height, origin }), `{ listener, scripts }` for the page given for the window,
// `listener` a function to hear it and `scripts` those its documents start with, as `run` takes them, or nothing for
// none, each `origin` the frame's that asks (origin(of:)); `download` ({ url }), a function to hear the
// download (WebDownload), or nothing to cancel it; `key` ({ type, code, key, meta, control, alt, shift }), true for a
// key taken; and `certificate` ({ url, host, error, fingerprint, subject, issuer }), true for a certificate trusted
// though the Mac does not. Asked, answered later through `reply`: `permission` ({ origin, permissions, reply }),
// `dialog` ({ kind, message, value, origin, reply }), what the page asks and waits on (PageDialog), of which it draws
// nothing, `unhandled` ({ code, key, meta, control, alt, shift, reply }), a key pressed that the page did not handle,
// true for one taken from the rest of the app, and, for a page made with a scheme of its own, `request`
// (SchemeHandler).
@MainActor
final class WebPage: NSObject {
    // MARK: - Property
    // The world deckit's own scripts run in, apart from the page's, which sees none of them.
    static let deckitWorld = WKContentWorld.world(name: "deckit")
    private static let messages = "deckit"
    // What a page may go to itself, beside a scheme of its own; any other scheme is an app's.
    private static let webSchemes: Set<String> = ["http", "https", "about", "data", "blob", "file", "javascript"]
    // WebKit's code for a load its navigation's policy turned into something else, a download.
    private static let interruptedByPolicy = (domain: "WebKitErrorDomain", code: 102)
    // WebKit opens a menu of its own on a press whose `contextmenu` the page did not prevent, which only the machine's
    // screen would show. Every frame prevents it before any listener hears it, so no press opens one; the event tells
    // each world only what that world's listeners did to it, and goes on to them as before.
    private static let menuless = """
        (() => {
            const prevent = Event.prototype.preventDefault;
            addEventListener('contextmenu', (event) => {
                if (!event.isTrusted) return;
                let prevented = false;
                Object.defineProperties(event, {
                    preventDefault: { value() { prevented ||= event.cancelable; } },
                    defaultPrevented: { get: () => prevented },
                    returnValue: { get: () => !prevented, set(value) { if (!value) event.preventDefault(); } }
                });
                prevent.call(event);
            }, true);
        })();
        """

    let id: Int
    let view: WebPageView
    private let emitter: Emitter
    private let adopt: @MainActor (WKWebViewConfiguration, [UserScript], Emitter) -> WebPage
    private let keep: @MainActor (WKDownload, Emitter) -> Void
    private var observations: [NSKeyValueObservation] = []
    // The address JavaScript asked to load, which asked deck before: its navigation is not asked again.
    private var requested: URL?
    // The dialogs the page waits on, each refused as the page closes, so no handler is left uncalled.
    private var dialogs: [PageDialog] = []
    // A page that waits on its dialog runs nothing, so it draws nothing new: what it drew last that came back is kept,
    // and a picture of it while it waits is that, as a page under a dialog shows frozen.
    private var drawnLast: CGImage?
    // Those a picture of the page is to be handed to, by take, each handed what the page drew last as a dialog goes up.
    private var drawing: [Int: @MainActor (CGImage?, Error?) -> Void] = [:]
    private var takes = 0

    // MARK: - Initializer
    // `configuration` is the page's, WebKit's own for a window a page opened, and `scripts` those every document of the
    // page starts with, as `run` sets them. `adopt` makes the page for such a window, and `keep` keeps a download the
    // page started, heard by the emitter JavaScript gave for it.
    init(
        id: Int,
        configuration: WKWebViewConfiguration,
        scripts: [UserScript],
        emitter: Emitter,
        adopt: @escaping @MainActor (WKWebViewConfiguration, [UserScript], Emitter) -> WebPage,
        keep: @escaping @MainActor (WKDownload, Emitter) -> Void
    ) {
        // A window's configuration is its opener's copy, whose scripts and handlers are the opener's. The page's own
        // are set before the view is made, so the blank document a window opened at a blank address shows, which its
        // opener can script at once, starts with them; WebKit runs none in the empty one a window opened at another
        // address has until that address commits.
        configuration.userContentController = WKUserContentController()
        Self.add(scripts, to: configuration.userContentController)
        configuration.preferences.isElementFullscreenEnabled = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        let view = WebPageView(frame: .zero, configuration: configuration)
        view.isInspectable = true
        self.id = id
        self.view = view
        self.emitter = emitter
        self.adopt = adopt
        self.keep = keep
        super.init()
        configuration.userContentController.addScriptMessageHandler(
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
    // The paths of the files dropped on the page last.
    var droppedFiles: [String] { view.droppedFiles.map(\.path) }

    var state: [String: Any?] {
        [
            "url": view.url?.absoluteString ?? "",
            "title": view.title ?? "",
            "loading": view.isLoading,
            "canGoBack": view.canGoBack,
            "canGoForward": view.canGoForward,
            "blank": view.backForwardList.currentItem == nil,
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

    // The load under way is stopped first: WebKit drops a load asked while a cross-site one is still provisional, and
    // the page is left loading what it had.
    func load(_ url: URL) {
        requested = url
        view.stopLoading()
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
        view.take()
    }

    // The scripts every document of the page runs as it starts, in place of those it had.
    func run(_ scripts: [UserScript]) {
        let controller = view.configuration.userContentController
        controller.removeAllUserScripts()
        Self.add(scripts, to: controller)
    }

    // What a key does, asked of JavaScript before the page has it, `source` what it was put for, none for the
    // machine's.
    func pressed(_ event: NSEvent, source: String? = nil) -> Bool {
        var payload = Self.keystroke(of: event)
        payload["type"] = event.type == .keyDown ? "keyDown" : "keyUp"
        if let source { payload["source"] = source }

        return emitter.emit("key", payload) { node, value in try node.bool(value) } ?? false
    }

    // What a key pressed that the page did not handle does, asked of JavaScript after the page had it: whether it is
    // taken from the rest of the app. Until JavaScript answers, the app does not have it; one answered later and not
    // taken goes to the app's menu. One put for `source`, whose keys the app never has, that is not taken does in this
    // page alone what the app's menu would do for it (edit(_:)), answered at once or later.
    func unhandled(_ event: NSEvent, source: String? = nil) -> Bool {
        let answer = KeyAnswer()
        let reply = Reply { [weak self] node, arguments in
            guard answer.taken == nil else { return }
            let taken = try arguments.first.map { try node.bool($0) } ?? false
            answer.taken = taken
            guard !answer.asking, !taken else { return }
            if source == nil { NSApp.mainMenu?.performKeyEquivalent(with: event) } else { self?.edit(event) }
        }
        var payload = Self.keystroke(of: event)
        payload["reply"] = reply
        if let source { payload["source"] = source }
        emitter.emit("unhandled", payload)
        answer.asking = false
        if source != nil, answer.taken == false { edit(event) }

        return answer.taken ?? true
    }

    func pointed(_ event: NSEvent, source: String? = nil) {
        var payload: [String: Any?] = ["type": event.type == .leftMouseDown ? "mouseDown" : "mouseUp"]
        if let source { payload["source"] = source }
        emitter.emit("mouse", payload)
    }

    // The value of `source`, a function body that may await, as JSON, run in the page's world or deckit's, in the main
    // frame or in `frame`.
    func evaluate(
        _ source: String,
        in world: UserScript.World,
        frame: WKFrameInfo? = nil,
        done: @escaping @MainActor (Result<String, Error>) -> Void
    ) {
        view.callAsyncJavaScript(
            "return JSON.stringify(await (async () => { \(source) })()) ?? 'null'",
            arguments: [:],
            in: frame,
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

    // What the page draws now, as PNG, clear where it draws nothing; while it waits on a dialog, what it drew last.
    func snapshot(done: @escaping @MainActor (Result<Data, Error>) -> Void) {
        picture { picture, error in
            guard let picture,
                let png = NSBitmapImageRep(cgImage: picture).representation(using: .png, properties: [:])
            else {
                return done(.failure(error ?? NodeError(message: "the page drew nothing to take")))
            }
            done(.success(png))
        }
    }

    // What the page draws now; while it waits on a dialog, what it drew last, taking no new picture, or nothing.
    func picture(done: @escaping @MainActor (CGImage?, Error?) -> Void) {
        guard !dialogs.contains(where: { !$0.isAnswered }) else { return done(drawnLast, nil) }
        takes += 1
        let take = takes
        drawing[take] = done
        view.takeSnapshot(with: nil) { image, error in
            MainActor.assumeIsolated {
                let picture = image?.cgImage(forProposedRect: nil, context: nil, hints: nil)
                if let picture { self.drawnLast = picture }
                self.drawing.removeValue(forKey: take)?(picture, error)
            }
        }
    }

    // The process the page's content runs in ended, as a crash ends it, where WebKit says which process it is.
    func killProcess() {
        let selector = NSSelectorFromString("_webProcessIdentifier")
        guard view.responds(to: selector), let process = view.value(forKey: "_webProcessIdentifier") as? Int32,
              process > 0 else {
            return
        }

        kill(process, SIGKILL)
    }

    func close() {
        for dialog in dialogs { dialog.refuse() }
        dialogs = []
        handDrawnLast()
        for observation in observations { observation.invalidate() }
        observations = []
        view.stopLoading()
        view.configuration.userContentController.removeAllScriptMessageHandlers()
        view.navigationDelegate = nil
        view.uiDelegate = nil
        view.onFocus = nil
        view.removeFromSuperview()
        emitter.release()
    }

    // What deckit's scripts post, as text, from any frame of the page, and the reply its post's promise takes: told
    // with the frame's origin, whether it is the main frame, `evaluate(source, world)`, which runs `source` in that
    // frame as `evaluate` does, its value dropped, and `answer(text)`, the reply, nothing for null. JavaScript answers
    // true for one it answers later; any other is replied null at once. A reply runs no script, so it gives the page
    // no user gesture, as `evaluate` gives it one (WebKit's own).
    func received(
        _ body: Any,
        from frame: WKFrameInfo,
        reply: @escaping @MainActor @Sendable (Any?, String?) -> Void
    ) {
        guard let text = body as? String else { return reply(nil, nil) }
        var replied = false
        let answer = Reply { node, arguments in
            guard !replied else { return }
            let value = try arguments.first.flatMap { node.isNothing($0) ? nil : try node.string($0) }
            replied = true
            reply(value, nil)
        }
        let evaluate = Reply { [weak self] node, arguments in
            guard let source = try arguments.first.map({ try node.string($0) }) else { return }
            let world = try arguments.dropFirst().first.flatMap { node.isNothing($0) ? nil : try node.string($0) }
            self?.evaluate(source, in: world.flatMap(UserScript.World.init) ?? .page, frame: frame) { _ in }
        }
        let later = emitter.emit("message", [
            "body": text,
            "origin": Self.serialized(frame.securityOrigin),
            "main": frame.isMainFrame,
            "evaluate": evaluate,
            "answer": answer
        ]) { node, value in try node.bool(value) } ?? false
        if !later && !replied {
            replied = true
            reply(nil, nil)
        }
    }

    // MARK: - Private
    // The origin of the frame whose document starts `action`, serialized, or nothing for one no frame starts, such as
    // a load JavaScript asks for: WebKit then gives no `sourceFrame`, though it declares one, so it is read by its key.
    private static func origin(of action: WKNavigationAction) -> String? {
        (action.value(forKey: "sourceFrame") as? WKFrameInfo).map { serialized($0.securityOrigin) }
    }

    // An origin as the URL Standard serializes it: `null` for an opaque one, which has no scheme.
    static func serialized(_ origin: WKSecurityOrigin) -> String {
        guard !origin.protocol.isEmpty else { return "null" }
        let port = origin.port == 0 ? "" : ":\(origin.port)"

        return "\(origin.protocol)://\(origin.host)\(port)"
    }

    // What the app's menu does for `event` had it been the machine's key, done on this page's view: the action of the
    // menu's item whose key equivalent it is, sent to the view, where the view takes that action. One the view does not
    // take, as the app's own are, is done nowhere, and nothing goes to what has the window's keyboard.
    private func edit(_ event: NSEvent) {
        guard event.type == .keyDown,
              let item = NSApp.mainMenu.flatMap({ Self.item(of: event, in: $0) }),
              let action = item.action,
              view.responds(to: action) else { return }
        NSApp.sendAction(action, to: view, from: item)
    }

    // The item of `menu` or of a menu under it whose key equivalent `event` is.
    private static func item(of event: NSEvent, in menu: NSMenu) -> NSMenuItem? {
        let held: NSEvent.ModifierFlags = [.command, .control, .option, .shift]
        let typed = (event.charactersIgnoringModifiers ?? "").lowercased()
        guard !typed.isEmpty else { return nil }
        for item in menu.items {
            if let found = item.submenu.flatMap({ Self.item(of: event, in: $0) }) { return found }
            let equivalent = item.keyEquivalent
            guard !equivalent.isEmpty, equivalent.lowercased() == typed else { continue }
            // An equivalent written in capitals holds shift, whatever its mask says.
            var mask = item.keyEquivalentModifierMask.intersection(held)
            if equivalent != equivalent.lowercased() { mask.insert(.shift) }
            if mask == event.modifierFlags.intersection(held) { return item }
        }

        return nil
    }

    private static func keystroke(of event: NSEvent) -> [String: Any?] {
        let flags = event.modifierFlags

        return [
            "code": KeyCode(event.keyCode).name,
            "key": event.charactersIgnoringModifiers ?? "",
            "meta": flags.contains(.command),
            "control": flags.contains(.control),
            "alt": flags.contains(.option),
            "shift": flags.contains(.shift)
        ]
    }

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

    // A load that became a download stops; it did not fail.
    private func failed(_ error: Error) {
        let error = error as NSError
        if error.domain == Self.interruptedByPolicy.domain, error.code == Self.interruptedByPolicy.code {
            emitter.emit("stopped")
            return
        }
        emitter.emit("failed", [
            "code": error.code,
            "description": error.localizedDescription,
            "url": (error.userInfo[NSURLErrorFailingURLStringErrorKey] as? String)
                ?? (error.userInfo[NSURLErrorFailingURLErrorKey] as? URL)?.absoluteString
                ?? view.url?.absoluteString ?? ""
        ])
        emitter.emit("stopped")
    }

    private static func add(_ scripts: [UserScript], to controller: WKUserContentController) {
        for world in [WKContentWorld.page, deckitWorld] {
            controller.addUserScript(WKUserScript(
                source: menuless,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false,
                in: world
            ))
        }
        for script in scripts {
            controller.addUserScript(WKUserScript(
                source: script.source,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: script.mainFrameOnly,
                in: script.world == .page ? .page : deckitWorld
            ))
        }
    }

    // A function JavaScript answered with, to hear what it was given, or nil for anything else.
    private static func listener(_ node: Node, _ value: napi_value) throws -> Emitter? {
        var type = napi_undefined
        napi_typeof(node.environment, value, &type)

        return type == napi_function ? try Emitter(node: node, function: value) : nil
    }

    // A download is JavaScript's to hear, or cancelled.
    private func started(_ download: WKDownload) {
        let url = download.originalRequest?.url?.absoluteString ?? ""
        let heard: Emitter? = emitter.emit("download", ["url": url], read: Self.listener)
        guard let heard else {
            download.cancel { _ in }
            return
        }

        keep(download, heard)
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
    // address goes to the app, as JavaScript lets it, and the page stays. A link to download downloads.
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
        if let scheme = url.scheme?.lowercased(), !Self.webSchemes.contains(scheme),
            webView.configuration.urlSchemeHandler(forURLScheme: scheme) == nil
        {
            decisionHandler(.cancel)
            emitter.emit("external", ["url": url.absoluteString, "origin": Self.origin(of: navigationAction)])
            return
        }
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
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

    // What the page cannot show, or what the server says is a file to keep, is downloaded.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationResponsePolicy) -> Void
    ) {
        let disposition = (navigationResponse.response as? HTTPURLResponse)?
            .value(forHTTPHeaderField: "Content-Disposition")?
            .trimmingCharacters(in: .whitespaces)
            .lowercased()
        let attachment = disposition?.hasPrefix("attachment") ?? false
        decisionHandler(attachment || !navigationResponse.canShowMIMEType ? .download : .allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        started(download)
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        started(download)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        emitter.emit("started")
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        if view.clearWhileBlank {
            view.clearWhileBlank = false
            view.setValue(true, forKey: "drawsBackground")
        }
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
            "height": windowFeatures.height?.doubleValue,
            "origin": Self.origin(of: navigationAction)
        ]
        let given: (Emitter, [UserScript])? = emitter.emit("open", payload) { node, value in
            guard !node.isNothing(value), let listener = try node.member(value, "listener") else { return nil }
            guard let heard = try Self.listener(node, listener) else { return nil }

            return (heard, try node.member(value, "scripts").map { try UserScript.read(node, $0) } ?? [])
        }
        guard let (heard, scripts) = given else { return nil }
        let page = adopt(configuration, scripts, heard)
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
        askPermission(frame.securityOrigin, permissions, decisionHandler)
    }

    @available(macOS 27.0, *)
    func webView(
        _ webView: WKWebView,
        requestGeolocationPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void
    ) {
        askPermission(frame.securityOrigin, ["geolocation"], decisionHandler)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable () -> Void
    ) {
        ask(PageDialog(kind: "alert", message: message, frame: frame) { _ in completionHandler() })
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (Bool) -> Void
    ) {
        ask(PageDialog(kind: "confirm", message: message, frame: frame) { answer in
            completionHandler(answer.bool ?? false)
        })
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (String?) -> Void
    ) {
        ask(PageDialog(kind: "prompt", message: prompt, value: defaultText ?? "", frame: frame) { answer in
            completionHandler(answer.string)
        })
    }

    // WebKit's own hook, which it asks on a navigation of the page whose document asks to be let go; no hook lets it
    // go unasked. Its text is the engine's, never the page's, so the message is empty.
    @objc(_webView:runBeforeUnloadConfirmPanelWithMessage:initiatedByFrame:completionHandler:)
    func webView(
        _ webView: WKWebView,
        runBeforeUnloadConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (Bool) -> Void
    ) {
        ask(PageDialog(kind: "leave", message: "", frame: frame) { answer in completionHandler(answer.bool ?? true) })
    }
}

extension WebPage {
    // MARK: - Private
    // A dialog put to JavaScript, held until it is answered.
    private func ask(_ dialog: PageDialog) {
        dialogs.removeAll { $0.isAnswered }
        dialogs.append(dialog)
        handDrawnLast()
        let reply = Reply { node, arguments in dialog.reply(node, arguments.first) }
        emitter.emit("dialog", [
            "kind": dialog.kind,
            "message": dialog.message,
            "value": dialog.value,
            "origin": dialog.origin,
            "reply": reply
        ])
    }

    // Every picture still being taken handed what the page drew last, as a page that waits or is closed draws no more.
    private func handDrawnLast() {
        let waiting = drawing.values
        drawing = [:]
        for done in waiting { done(drawnLast, nil) }
    }

    // What a site asks for, by the web platform's names, put to JavaScript as `permission`: given on true, else
    // refused. `origin` is the frame's that asks, as the web platform asks a frame's permission.
    private func askPermission(
        _ origin: WKSecurityOrigin,
        _ permissions: [String],
        _ decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void
    ) {
        var answered = false
        let reply = Reply { node, arguments in
            guard !answered else { return }
            answered = true
            let granted = try arguments.first.map { try node.bool($0) } ?? false
            decisionHandler(granted ? .grant : .deny)
        }
        emitter.emit("permission", [
            "origin": Self.serialized(origin),
            "permissions": permissions,
            "reply": reply
        ])
    }
}

// A dialog a page asks, `kind` `alert`, `confirm`, `prompt` or `leave`, put to JavaScript as `dialog` and answered
// once, by `reply` or refused: `answered` is handed what JavaScript replied, a value that is no boolean or string for
// the refusal, which each kind reads as its own.
@MainActor
private final class PageDialog {
    struct Answer {
        var bool: Bool?
        var string: String?
    }

    let kind: String
    let message: String
    let value: String
    let origin: String
    private var answered: (@MainActor (Answer) -> Void)?

    init(
        kind: String,
        message: String,
        value: String = "",
        frame: WKFrameInfo,
        answered: @escaping @MainActor (Answer) -> Void
    ) {
        self.kind = kind
        self.message = message
        self.value = value
        self.origin = WebPage.serialized(frame.securityOrigin)
        self.answered = answered
    }

    var isAnswered: Bool { answered == nil }

    func reply(_ node: Node, _ value: napi_value?) {
        settle(Answer(bool: value.flatMap { try? node.bool($0) }, string: value.flatMap { try? node.string($0) }))
    }

    func refuse() {
        settle(Answer())
    }

    private func settle(_ answer: Answer) {
        guard let answered else { return }
        self.answered = nil
        answered(answer)
    }
}

// What JavaScript answered of a key the page did not handle, and whether it is still being asked.
@MainActor
private final class KeyAnswer {
    var taken: Bool?
    var asking = true
}
