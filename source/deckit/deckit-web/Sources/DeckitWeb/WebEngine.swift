//
//  WebEngine.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import WebKit
import CNodeAPI

// The pages, windows and stages the module made, each by an id of its own, and what JavaScript does to them and to
// the pages' data stores (Export).
// - Pages: `make({ store, applicationName, cookieLifetime, scheme, clear, fullSpeed }, emit) -> id` (WebPage),
//   `scheme` a scheme of its own (SchemeHandler), `clear` drawing nothing where the document does not, as do the
//   windows it opens, `fullSpeed` running off screen or covered as on it; `load(id, url)`; `go(id, to)`; `focus(id)`;
//   `isFocused(id)`; `focusedPage()`, the page with the keyboard, or null; `state(id)`; `droppedFiles(id)`, the paths
//   of the files dropped on it last; `run(id, [{ source, world, mainFrameOnly }])`; `evaluate(id, source, world) ->
//   Promise of JSON`; `find(id, text, { backwards, caseSensitive }) -> Promise of whether it found it`;
//   `fetchText(store, url, { limit, applicationName }) -> Promise of the text`, asked as the store's pages made with
//   `applicationName` ask; `clear(store) -> Promise`; `close(id)`; `safariVersion()`.
// - Downloads a page started (WebDownload): `cancelDownload(id)`, nothing for one that ended.
// - Windows: `openWindow({ kind, size, title, showsTitle, color, material, buttons }, emit) -> id` (Window), `color`
//   `{ red, green, blue }` and `material` one of `hud`, `sidebar`, `menu`, `popover`; `showWindow(id, { focus })`;
//   `hideWindow(id)`; `closeWindow(id)`; `windowFrame(id)`, `setWindowFrame(id, rect)`, in the screen's space;
//   `windowState(id) -> { fullScreen, zoomed }`; `windowSize(id)`, `setWindowSize(id, size)`, its content's;
//   `setTitle(id, title)`; `setColor(id, color)`; `keyWindow()`, the window with the keyboard, or null;
//   `doubleClickTitleBar(id)`; `drag(id)`, moved by the press of the mouse under way, false where none is;
//   `previewFile(id, file, title)` and `closeFilePreview(id)`, Quick Look's panel over the window;
//   `showOpenDialog(id, options) -> Promise of the paths chosen, none when cancelled` and
//   `showSaveDialog(id, options) -> Promise of the path, or null`, as a sheet on it, `options` NSOpenPanel's (dress).
// - Input as a person's would come, through the app's watch on its events (WebPage+Input): `sendKey(id, { code, key,
//   alt, ctrl, meta, shift })`, `code` and `key` as the web names them; `sendMouse(id, { type, x, y })`, `type` `down`,
//   `dragged` or `up`, at a point from the page's top left; `sendDrop(id, { files, x, y }) -> Promise`, files from
//   outside the app dropped there. `snapshot(id) -> Promise of a PNG in base64`; `killProcess(id)`, its content's
//   process ended as a crash ends it; `pages()` and `windows()`, the ids of those open.
// - Stages (Stage): `makeStage() -> id`; `placeStage(id, { window, frame, front })`; `layStage(id, [{ page, frame,
//   clip } | { page, hidden: true }])`, `clip` a rect on the stage the page is cut to; `showStage(id, on)`;
//   `removeStage(id)`; and `tree(window)`, a window's views as text, a page's view with its id.
// A store is a UUID, as WebKit names a data store; none keeps nothing.
@MainActor
final class WebEngine {
    // MARK: - Property
    private let node: Node
    private var pages: [Int: WebPage] = [:]
    private var windows: [Int: Window] = [:]
    private var stages: [Int: Stage] = [:]
    private var downloads: [Int: WebDownload] = [:]
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
        let window = { (index: Int) throws -> Window in
            let id = Int(try self.node.number(try argument(index)))
            guard let window = self.windows[id] else { throw NodeError(message: "no window \(id)") }

            return window
        }
        let stage = { () throws -> Stage in
            let id = Int(try self.node.number(try argument(0)))
            guard let stage = self.stages[id] else { throw NodeError(message: "no stage \(id)") }

            return stage
        }

        switch export {
        case .make:
            return try node.make(try make(try argument(0), emit: try argument(1)))

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

        case .focusedPage:
            let responder = NSApp.keyWindow?.firstResponder as? NSView
            return try node.make(responder.flatMap { self.page(holding: $0) }?.id)

        case .state:
            return try node.make(try page().state)

        case .droppedFiles:
            return try node.make(try page().droppedFiles)

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

        case .fetchText:
            let store = try storeOf(try string(0))
            let address = try string(1)
            guard let url = URL(string: address) else { throw NodeError(message: "not an address: \(address)") }
            let options = try argument(2)
            guard let limit = try node.member(options, "limit").map({ Int(try node.number($0)) }) else {
                throw NodeError(message: "fetchText takes { limit, applicationName }")
            }
            let applicationName = try node.member(options, "applicationName").map { try node.string($0) } ?? ""
            let fetcher = TextFetcher(store: store, applicationName: applicationName)
            let (promise, settle) = try promised()
            Task { @MainActor in
                do {
                    settle(.success(try await fetcher.text(at: url, limit: limit)))
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

        case .cancelDownload:
            downloads[Int(try node.number(try argument(0)))]?.cancel()

        case .safariVersion:
            let version = Bundle(path: "/Applications/Safari.app")?
                .object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
            return try node.make(version)

        case .openWindow:
            return try node.make(try openWindow(try argument(0), emit: try argument(1)))

        case .showWindow:
            let options = arguments.count > 1 && !node.isNothing(arguments[1]) ? arguments[1] : nil
            let focus = try options.flatMap { try node.member($0, "focus") }.map { try node.bool($0) }
            try window(0).show(focus: focus ?? true)

        case .hideWindow:
            try window(0).hide()

        case .closeWindow:
            try window(0).close()

        case .windowFrame:
            return try node.make(Self.plain(try window(0).frame))

        case .windowState:
            let shown = try window(0).window
            return try node.make([
                "fullScreen": shown.styleMask.contains(.fullScreen),
                "zoomed": shown.isZoomed
            ] as [String: Any?])

        case .setWindowFrame:
            try window(0).setFrame(try node.rect(try argument(1)))

        case .windowSize:
            let size = try window(0).contentSize
            return try node.make(["width": Double(size.width), "height": Double(size.height)] as [String: Any?])

        case .setWindowSize:
            try window(0).setContentSize(try size(try argument(1)))

        case .setTitle:
            try window(0).setTitle(try string(1))

        case .setColor:
            try window(0).setColor(try color(arguments.count > 1 ? arguments[1] : nil))

        case .keyWindow:
            return try node.make(windows.values.first { $0.window.isKeyWindow }?.id)

        case .doubleClickTitleBar:
            try window(0).doubleClickTitleBar()

        case .drag:
            let window = try window(0)
            guard let press = input.press, press.window === window.window, NSEvent.pressedMouseButtons & 1 != 0 else {
                return try node.make(false)
            }
            window.drag(from: press)
            return try node.make(true)

        case .sendKey:
            let options = try argument(1)
            let text = { (name: String) throws -> String? in
                try self.node.member(options, name).map { try self.node.string($0) }
            }
            let held = { (name: String) throws -> Bool in
                try self.node.member(options, name).map { try self.node.bool($0) } ?? false
            }
            guard let code = try text("code").flatMap(KeyCode.init(name:)) else {
                throw NodeError(message: "a key is named by its code")
            }
            var modifiers: NSEvent.ModifierFlags = []
            if try held("alt") { modifiers.insert(.option) }
            if try held("ctrl") { modifiers.insert(.control) }
            if try held("meta") { modifiers.insert(.command) }
            if try held("shift") { modifiers.insert(.shift) }
            try page().sendKey(code, key: try text("key") ?? "", modifiers: modifiers, through: input)

        case .sendMouse:
            let options = try argument(1)
            guard let name = try node.member(options, "type").map({ try node.string($0) }),
                let type = Self.mouseEvents[name],
                let x = try node.member(options, "x"),
                let y = try node.member(options, "y")
            else {
                throw NodeError(message: "a mouse event is { type, x, y }, its type down, dragged or up")
            }
            try page().sendMouse(type, at: CGPoint(x: try node.number(x), y: try node.number(y)), through: input)

        case .sendDrop:
            let options = try argument(1)
            guard let files = try node.member(options, "files").map({ try node.array($0).map(node.string) }),
                let x = try node.member(options, "x"),
                let y = try node.member(options, "y")
            else {
                throw NodeError(message: "a drop is { files, x, y }, `files` their paths")
            }
            let page = try page()
            let point = CGPoint(x: try node.number(x), y: try node.number(y))
            let (promise, settle) = try promised()
            Task { @MainActor in
                do {
                    try await page.sendDrop(files.map { URL(fileURLWithPath: $0) }, at: point)
                    settle(.success(nil))
                } catch {
                    settle(.failure(error))
                }
            }
            return promise

        case .snapshot:
            let (promise, settle) = try promised()
            try page().snapshot { result in
                settle(result.map { $0.base64EncodedString() })
            }
            return promise

        case .killProcess:
            try page().killProcess()

        case .pages:
            return try node.make(pages.keys.sorted())

        case .windows:
            return try node.make(windows.keys.sorted())

        case .previewFile:
            try window(0).previewFile(URL(fileURLWithPath: try string(1)), title: try string(2))

        case .closeFilePreview:
            try window(0).closeFilePreview()

        case .showOpenDialog:
            let shown = try window(0)
            let panel = NSOpenPanel()
            let options = arguments.count > 1 && !node.isNothing(arguments[1]) ? arguments[1] : nil
            try dress(panel, options)
            let flag = { (name: String) throws -> Bool? in
                try options.flatMap { try self.node.member($0, name) }.map { try self.node.bool($0) }
            }
            panel.canChooseFiles = try flag("canChooseFiles") ?? true
            panel.canChooseDirectories = try flag("canChooseDirectories") ?? false
            panel.allowsMultipleSelection = try flag("allowsMultipleSelection") ?? false
            let (promise, settle) = try promised()
            Task { @MainActor in
                let response = await shown.runSheet(panel)
                settle(.success(response == .OK ? panel.urls.map(\.path) : []))
            }
            return promise

        case .showSaveDialog:
            let shown = try window(0)
            let panel = NSSavePanel()
            try dress(panel, arguments.count > 1 && !node.isNothing(arguments[1]) ? arguments[1] : nil)
            let (promise, settle) = try promised()
            Task { @MainActor in
                let response = await shown.runSheet(panel)
                settle(.success(response == .OK ? panel.url?.path : nil))
            }
            return promise

        case .makeStage:
            lastID += 1
            stages[lastID] = Stage(id: lastID)
            return try node.make(lastID)

        case .placeStage:
            let options = try argument(1)
            guard let id = try node.member(options, "window"), let frame = try node.member(options, "frame") else {
                throw NodeError(message: "a stage is placed in a window, at a frame")
            }
            try stage().place(
                in: try self.window(at: id),
                frame: try node.rect(frame),
                front: try node.member(options, "front").map { try node.bool($0) } ?? false
            )

        case .layStage:
            try stage().lay(try node.array(try argument(1)).map { layer in
                guard let id = try node.member(layer, "page") else { throw NodeError(message: "a layer needs a page") }
                let page = Int(try node.number(id))
                guard let laid = pages[page] else { throw NodeError(message: "no web page \(page)") }
                if try node.member(layer, "hidden").map({ try node.bool($0) }) == true { return (laid, nil, nil) }
                guard let frame = try node.member(layer, "frame") else {
                    throw NodeError(message: "a layer is { page, frame, clip } or { page, hidden: true }")
                }

                return (laid, try node.rect(frame), try node.member(layer, "clip").map { try node.rect($0) })
            })

        case .showStage:
            try stage().show(try node.bool(try argument(1)))

        case .removeStage:
            let removed = try stage()
            removed.remove()
            stages[removed.id] = nil

        case .tree:
            return try node.make(tree(of: try window(0).window.contentView ?? NSView()))
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
        let emitter = try Emitter(node: node, function: emit)
        if let scheme = try node.member(options, "scheme").map({ try node.string($0) }) {
            configuration.setURLSchemeHandler(SchemeHandler(emitter: emitter), forURLScheme: scheme)
        }
        let fullSpeed = try node.member(options, "fullSpeed").map { try node.bool($0) } ?? false
        if fullSpeed { Self.runOffScreen(configuration.preferences) }
        let clear = try node.member(options, "clear").map { try node.bool($0) } ?? false

        return adopt(configuration, emitter, clear: clear, fullSpeed: fullSpeed).id
    }

    // A download a page started, kept by its id until it ends.
    private func keep(_ download: WKDownload, _ emitter: Emitter) {
        lastID += 1
        let kept = WebDownload(id: lastID, download: download, emitter: emitter) { [weak self] ended in
            self?.downloads[ended.id] = nil
        }
        downloads[kept.id] = kept
        kept.announce()
    }

    // A page of the module's, on `configuration`: a new one, or WebKit's for a window a page opened, clear and at full
    // speed as the page that opened it is.
    private func adopt(
        _ configuration: WKWebViewConfiguration,
        _ emitter: Emitter,
        clear: Bool,
        fullSpeed: Bool
    ) -> WebPage {
        lastID += 1
        let page = WebPage(
            id: lastID,
            configuration: configuration,
            emitter: emitter,
            adopt: { [weak self] configuration, emitter in
                guard let self else { fatalError("a web page outlived the module") }

                return adopt(configuration, emitter, clear: clear, fullSpeed: fullSpeed)
            },
            keep: { [weak self] download, emitter in
                self?.keep(download, emitter)
            }
        )
        if clear { Self.drawNoBackground(page.view) }
        if fullSpeed { Self.runWhileCovered(page.view) }
        pages[page.id] = page
        input.start()

        return page
    }

    private func openWindow(_ options: napi_value, emit: napi_value) throws -> Int {
        let member = { (name: String) throws -> napi_value? in try self.node.member(options, name) }
        let size = try member("size").map { try self.size($0) } ?? CGSize(width: 800, height: 600)
        let buttons = try member("buttons").map { try point($0) }
        lastID += 1
        let window = Window(
            id: lastID,
            kind: try member("kind").map { Window.Kind(rawValue: try node.string($0)) ?? .titled } ?? .titled,
            size: size,
            title: try member("title").map { try node.string($0) } ?? "",
            showsTitle: try member("showsTitle").map { try node.bool($0) } ?? true,
            color: try color(try member("color")),
            material: try member("material").map { Self.materials[try node.string($0)] ?? .hudWindow },
            buttons: buttons,
            emitter: try Emitter(node: node, function: emit)
        )
        windows[window.id] = window
        let id = window.id
        window.ended = { [weak self] in
            self?.windows[id] = nil
        }

        return id
    }

    // A dialog's `title`, `message`, `prompt`, `directory` it opens in, `name` in its name field, and whether it
    // `canCreateDirectories` and `showsHiddenFiles`, as `options` give them.
    private func dress(_ panel: NSSavePanel, _ options: napi_value?) throws {
        guard let options else { return }
        let text = { (name: String) throws -> String? in
            try self.node.member(options, name).map { try self.node.string($0) }
        }
        let flag = { (name: String) throws -> Bool? in
            try self.node.member(options, name).map { try self.node.bool($0) }
        }
        if let title = try text("title") { panel.title = title }
        if let message = try text("message") { panel.message = message }
        if let prompt = try text("prompt") { panel.prompt = prompt }
        if let directory = try text("directory") {
            panel.directoryURL = URL(fileURLWithPath: directory, isDirectory: true)
        }
        if let name = try text("name") { panel.nameFieldStringValue = name }
        if let create = try flag("canCreateDirectories") { panel.canCreateDirectories = create }
        if let hidden = try flag("showsHiddenFiles") { panel.showsHiddenFiles = hidden }
    }

    private func window(at value: napi_value) throws -> Window {
        let id = Int(try node.number(value))
        guard let window = windows[id] else { throw NodeError(message: "no window \(id)") }

        return window
    }

    private func size(_ value: napi_value) throws -> CGSize {
        guard let width = try node.member(value, "width"), let height = try node.member(value, "height") else {
            throw NodeError(message: "a size needs width and height")
        }

        return CGSize(width: try node.number(width), height: try node.number(height))
    }

    private func point(_ value: napi_value) throws -> CGPoint {
        guard let x = try node.member(value, "x"), let y = try node.member(value, "y") else {
            throw NodeError(message: "a point needs x and y")
        }

        return CGPoint(x: try node.number(x), y: try node.number(y))
    }

    // `{ red, green, blue }`, each 0 to 255, or none.
    private func color(_ value: napi_value?) throws -> NSColor? {
        guard let value, !node.isNothing(value) else { return nil }
        let part = { (name: String) throws -> CGFloat in
            guard let part = try self.node.member(value, name) else {
                throw NodeError(message: "a colour needs \(name)")
            }

            return CGFloat(try self.node.number(part)) / 255
        }

        return NSColor(srgbRed: try part("red"), green: try part("green"), blue: try part("blue"), alpha: 1)
    }

    private static let mouseEvents: [String: NSEvent.EventType] = [
        "down": .leftMouseDown,
        "dragged": .leftMouseDragged,
        "up": .leftMouseUp
    ]

    private static let materials: [String: NSVisualEffectView.Material] = [
        "hud": .hudWindow,
        "sidebar": .sidebar,
        "menu": .menu,
        "popover": .popover
    ]

    private static func plain(_ rect: CGRect) -> [String: Any?] {
        ["x": Double(rect.minX), "y": Double(rect.minY), "width": Double(rect.width), "height": Double(rect.height)]
    }

    // WebKit's settings that keep a page's timers and process at full speed while it is not seen, where it has them.
    private static func runOffScreen(_ preferences: WKPreferences) {
        preferences.inactiveSchedulingPolicy = .none
        typealias Setter = @convention(c) (AnyObject, Selector, Bool) -> Void
        for name in ["_setHiddenPageDOMTimerThrottlingEnabled:", "_setPageVisibilityBasedProcessSuppressionEnabled:"] {
            let selector = NSSelectorFromString(name)
            guard preferences.responds(to: selector) else { continue }
            unsafeBitCast(preferences.method(for: selector), to: Setter.self)(preferences, selector, false)
        }
    }

    // WebKit's setting that keeps a page seen, its animation frames running, while other windows cover its window,
    // where it has it.
    private static func runWhileCovered(_ view: WKWebView) {
        let selector = NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")
        guard view.responds(to: selector) else { return }
        typealias Setter = @convention(c) (AnyObject, Selector, Bool) -> Void
        unsafeBitCast(view.method(for: selector), to: Setter.self)(view, selector, false)
    }

    // Clear where the document draws nothing, where WebKit lets a page be.
    private static func drawNoBackground(_ view: WKWebView) {
        guard view.responds(to: NSSelectorFromString("_setDrawsBackground:")) else { return }
        view.setValue(false, forKey: "drawsBackground")
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
            + (pages.values.first { $0.view === view }.map { " page \($0.id)" } ?? "")

        return ([line] + view.subviews.map { tree(of: $0, depth: depth + 1) }).joined(separator: "\n")
    }
}
