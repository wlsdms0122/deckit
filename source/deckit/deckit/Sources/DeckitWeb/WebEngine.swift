//
//  WebEngine.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import WebKit
import CNodeAPI

// The web pages the module made, by id, and what JavaScript does to them (Export): `make({ store, applicationName },
// emit) -> id`, `place(id, { window, page, above, frame, visible, holes })`, `load(id, url)`, `go(id, to)`, `focus(id)`,
// `isFocused(id)`, `state(id)`, `evaluate(id, source) -> Promise of JSON`, `snapshot(id) -> Promise of a PNG's data
// URL`, `close(id)`, `safariVersion()` and
// `tree(window)`, the window's views as text.
@MainActor
final class WebEngine {
    // MARK: - Property
    private let node: Node
    private var pages: [Int: WebPage] = [:]
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

        switch export {
        case .make:
            return try node.make(try make(try argument(0), emit: try argument(1)))

        case .place:
            let layout = try argument(1)
            let visible = try node.member(layout, "visible").map { try node.bool($0) } ?? true
            guard visible else {
                try page().hide()
                return node.undefined()
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
                    Hole(rect: try node.rect(hole), radius: try node.member(hole, "radius").map { try node.number($0) } ?? 0)
                }
            } ?? []
            let view = Unmanaged<NSView>.fromOpaque(try node.pointer(window)).takeUnretainedValue()
            try page().place(
                in: view,
                page: try node.rect(laid),
                above: above,
                frame: try node.rect(frame),
                holes: holes
            )

        case .load:
            let address = try node.string(try argument(1))
            guard let url = URL(string: address) else { throw NodeError(message: "not an address: \(address)") }
            try page().load(url)

        case .go:
            try page().go(try node.string(try argument(1)))

        case .focus:
            try page().focus()

        case .isFocused:
            return try node.make(try page().isFocused)

        case .state:
            return try node.make(try page().state)

        case .evaluate:
            let (promise, settle) = try promised()
            try page().evaluate(try node.string(try argument(1))) { result in settle(result.map { $0 }) }
            return promise

        case .snapshot:
            let (promise, settle) = try promised()
            try page().snapshot { result in
                settle(result.map { "data:image/png;base64," + $0.base64EncodedString() })
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
        let store = try node.member(options, "store").map { try node.string($0) }
        let applicationName = try node.member(options, "applicationName").map { try node.string($0) } ?? ""
        lastID += 1
        let page = WebPage(
            id: lastID,
            store: store.flatMap { UUID(uuidString: $0) },
            applicationName: applicationName,
            emitter: try Emitter(node: node, function: emit)
        )
        pages[page.id] = page
        input.start()

        return page.id
    }

    private func page(holding view: NSView) -> WebPage? {
        pages.values.first { view.isDescendant(of: $0.view) }
    }

    // A promise, and what settles it with a string or an error, as a callback settles one, so what waits on it runs
    // then.
    private func promised() throws -> (napi_value?, @MainActor (Result<String, Error>) -> Void) {
        var deferred: napi_deferred?
        var promise: napi_value?
        try node.check(napi_create_promise(node.environment, &deferred, &promise))
        let node = node
        let settle: @MainActor (Result<String, Error>) -> Void = { result in
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
                napi_resolve_deferred(node.environment, deferred, try? node.make(value))

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
