//
//  WebEngine.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import WebKit
import CNodeAPI

// The web pages the module made, by id, and what JavaScript does to them and to their data stores (Export):
// `make({ store, applicationName, cookieLifetime }, emit) -> id`; `place(id, { window, page, above, frame, visible,
// holes })`; `load(id, url)`; `go(id, to)`; `focus(id)`; `isFocused(id)`; `state(id)`; `run(id, [{ source, world,
// mainFrameOnly }])`; `evaluate(id, source, world) -> Promise of JSON`; `find(id, text, { backwards, caseSensitive })
// -> Promise of whether it found it`; `snapshot(id) -> Promise of a PNG's data URL`; `fetchText(store, url, limit) ->
// Promise of the text`; `clear(store) -> Promise`; `close(id)`; `safariVersion()`; and `tree(window)`, the window's
// views as text. A store is a UUID, as WebKit names a data store; none keeps nothing.
@MainActor
final class WebEngine {
    // MARK: - Property
    private let node: Node
    private var pages: [Int: WebPage] = [:]
    private var keepers: [UUID: CookieKeeper] = [:]
    private var lastID = 0
    private lazy var input = InputMonitor { [weak self] view in
        self?.page(holding: view)
    }

    // MARK: - Initializer
    init(node: Node) {
        self.node = node
    }

    // MARK: - Public
    func call(_ export: Export, _ arguments: [napi_value]) throws -> napi_value? {
        let argument = { (index: Int) throws -> napi_value in
            guard index < arguments.count, !self.node.isNothing(arguments[index]) else {
                throw NodeError(message: "\(export) needs argument \(index + 1)")
            }

            return arguments[index]
        }
        let page = { () throws -> WebPage in
            let id = Int(try self.node.number(try argument(0)))
            guard let page = self.pages[id] else { throw NodeError(message: "no web page \(id)") }

            return page
        }
        let string = { (index: Int) throws -> String in try self.node.string(try argument(index)) }

        switch export {
        case .make:
            return try node.make(try make(try argument(0), emit: try argument(1)))

        case .place:
            try place(try page(), try argument(1))

        case .load:
            let address = try string(1)
            guard let url = URL(string: address) else { throw NodeError(message: "not an address: \(address)") }
            try page().load(url)

        case .go:
            try page().go(try string(1))

        case .focus:
            try page().focus()

        case .isFocused:
            return try node.make(try page().isFocused)

        case .state:
            return try node.make(try page().state)

        case .run:
            try page().run(try node.array(try argument(1)).map { script in
                guard let source = try node.member(script, "source") else {
                    throw NodeError(message: "a script needs its source")
                }
                let world = try node.member(script, "world").map { try node.string($0) }

                return UserScript(
                    source: try node.string(source),
                    world: world.flatMap(UserScript.World.init) ?? .page,
                    mainFrameOnly: try node.member(script, "mainFrameOnly").map { try node.bool($0) } ?? true
                )
            })

        case .evaluate:
            let world = arguments.count > 2 && !node.isNothing(arguments[2]) ? try string(2) : "page"
            let (promise, settle) = try promised()
            try page().evaluate(try string(1), in: UserScript.World(rawValue: world) ?? .page) { result in
                settle(result.map { $0 })
            }
            return promise

        case .find:
            let options = arguments.count > 2 && !node.isNothing(arguments[2]) ? arguments[2] : nil
            let flag = { (name: String) throws -> Bool in
                try options.flatMap { try self.node.member($0, name) }.map { try self.node.bool($0) } ?? false
            }
            let (promise, settle) = try promised()
            try page().find(try string(1), backwards: try flag("backwards"), caseSensitive: try flag("caseSensitive")) {
                settle(.success($0))
            }
            return promise

        case .snapshot:
            let (promise, settle) = try promised()
            try page().snapshot { result in
                settle(result.map { "data:image/png;base64," + $0.base64EncodedString() })
            }
            return promise

        case .fetchText:
            let store = try storeOf(try string(0))
            let address = try string(1)
            guard let url = URL(string: address) else { throw NodeError(message: "not an address: \(address)") }
            let limit = Int(try node.number(try argument(2)))
            let (promise, settle) = try promised()
            Task { @MainActor in
                do {
                    settle(.success(try await TextFetcher(store: store).text(at: url, limit: limit)))
                } catch {
                    settle(.failure(error))
                }
            }
            return promise

        case .clear:
            let store = try storeOf(try string(0))
            let (promise, settle) = try promised()
            WKWebsiteDataStore(forIdentifier: store).removeData(
                ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
                modifiedSince: .distantPast
            ) {
                MainActor.assumeIsolated { settle(.success(nil)) }
            }
            return promise

        case .close:
            let closed = try page()
            closed.close()
            pages[closed.id] = nil

        case .safariVersion:
            let version = Bundle(path: "/Applications/Safari.app")?
                .object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
            return try node.make(version)

        case .tree:
            let view = Unmanaged<NSView>.fromOpaque(try node.pointer(try argument(0))).takeUnretainedValue()
            return try node.make(tree(of: view.window?.contentView ?? view))
        }

        return node.undefined()
    }

    // MARK: - Private
    private func make(_ options: napi_value, emit: napi_value) throws -> Int {
        let store = try node.member(options, "store").map { try storeOf(try node.string($0)) }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = store.map { WKWebsiteDataStore(forIdentifier: $0) } ?? .nonPersistent()
        configuration.applicationNameForUserAgent = try node.member(options, "applicationName")
            .map { try node.string($0) } ?? ""
        if let store, let lifetime = try node.member(options, "cookieLifetime").map({ try node.number($0) }),
            keepers[store] == nil
        {
            keepers[store] = CookieKeeper(store: configuration.websiteDataStore.httpCookieStore, lifetime: lifetime)
        }
        let page = adopt(configuration, try Emitter(node: node, function: emit))

        return page.id
    }

    // A page of the module's, on `configuration`: a new one, or WebKit's for a window a page opened.
    private func adopt(_ configuration: WKWebViewConfiguration, _ emitter: Emitter) -> WebPage {
        lastID += 1
        let page = WebPage(
            id: lastID,
            configuration: configuration,
            emitter: emitter
        ) { [weak self] configuration, emitter in
            guard let self else { fatalError("a web page outlived the module") }

            return adopt(configuration, emitter)
        }
        pages[page.id] = page
        input.start()

        return page
    }

    // `{ window, page, above, frame, visible, holes }` (WebPage.place), or a page not shown.
    private func place(_ page: WebPage, _ layout: napi_value) throws {
        let visible = try node.member(layout, "visible").map { try node.bool($0) } ?? true
        guard visible else {
            page.hide()
            return
        }
        guard let window = try node.member(layout, "window"),
            let laid = try node.member(layout, "page"),
            let frame = try node.member(layout, "frame")
        else {
            throw NodeError(message: "a layout needs a window, a page and a frame")
        }

        let above = try node.member(layout, "above").map { Int(try node.number($0)) } ?? 0
        let holes = try node.member(layout, "holes").map { list in
            try node.array(list).map { hole in
                Hole(
                    rect: try node.rect(hole),
                    radius: try node.member(hole, "radius").map { try node.number($0) } ?? 0
                )
            }
        } ?? []
        page.place(
            in: Unmanaged<NSView>.fromOpaque(try node.pointer(window)).takeUnretainedValue(),
            page: try node.rect(laid),
            above: above,
            frame: try node.rect(frame),
            holes: holes
        )
    }

    private func storeOf(_ text: String) throws -> UUID {
        guard let store = UUID(uuidString: text) else { throw NodeError(message: "not a data store: \(text)") }

        return store
    }

    private func page(holding view: NSView) -> WebPage? {
        pages.values.first { view.isDescendant(of: $0.view) }
    }

    // A promise, and what settles it with a value or an error, as a callback settles one, so what waits on it runs
    // then.
    private func promised() throws -> (napi_value?, @MainActor (Result<Any?, Error>) -> Void) {
        var deferred: napi_deferred?
        var promise: napi_value?
        try node.check(napi_create_promise(node.environment, &deferred, &promise))
        let node = node
        let settle: @MainActor (Result<Any?, Error>) -> Void = { result in
            var handles: napi_handle_scope?
            napi_open_handle_scope(node.environment, &handles)
            defer { napi_close_handle_scope(node.environment, handles) }
            var resource: napi_value?
            var name: napi_value?
            var context: napi_async_context?
            var scope: napi_callback_scope?
            napi_create_object(node.environment, &resource)
            napi_create_string_utf8(node.environment, "deckit-web", 10, &name)
            napi_async_init(node.environment, resource, name, &context)
            napi_open_callback_scope(node.environment, resource, context, &scope)
            switch result {
            case let .success(value):
                napi_resolve_deferred(node.environment, deferred, (try? node.make(value)) ?? node.undefined())

            case let .failure(error):
                var message: napi_value?
                var thrown: napi_value?
                let text = (error as? NodeError)?.message ?? error.localizedDescription
                napi_create_string_utf8(node.environment, text, text.utf8.count, &message)
                napi_create_error(node.environment, nil, message, &thrown)
                napi_reject_deferred(node.environment, deferred, thrown)
            }
            napi_close_callback_scope(node.environment, scope)
            napi_async_destroy(node.environment, context)
        }

        return (promise, settle)
    }

    private func tree(of view: NSView, depth: Int = 0) -> String {
        let line = String(repeating: "  ", count: depth)
            + "\(type(of: view)) \(NSStringFromRect(view.frame))\(view.isHidden ? " hidden" : "")"
            + "\(view.isFlipped ? " flipped" : "")"

        return ([line] + view.subviews.map { tree(of: $0, depth: depth + 1) }).joined(separator: "\n")
    }
}
