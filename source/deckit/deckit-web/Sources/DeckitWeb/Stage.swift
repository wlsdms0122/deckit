//
//  Stage.swift
//  DeckitWeb
//
//  Created by JSilver on 11/1/26.
//

import AppKit

// Where pages are laid in a window: a view of its own, clear where no page draws, placed in the window's content, and
// the pages in it, drawn in the order they are laid. Frames are from the top left, a stage's in the window's content
// and a page's in the stage.
@MainActor
final class Stage {
    // MARK: - Property
    let id: Int
    let view: NSView = StageView()
    private var laid: [WebPage] = [] // the pages it put on screen, in its view or a clip of its own
    private var clips: [ObjectIdentifier: NSView] = [:] // a page -> the clip it is drawn in

    // MARK: - Initializer
    init(id: Int) {
        self.id = id
    }

    // MARK: - Public
    // In `window`'s content at `frame`, keeping its margins as the window changes size. With `front` it goes over what
    // is in the window already; without, one already there stays where it is among the rest.
    func place(in window: Window, frame: CGRect, front: Bool) {
        guard let content = window.window.contentView else { return }
        if view.superview !== content || front {
            view.removeFromSuperview()
            content.addSubview(view)
        }
        view.frame = CGRect(
            x: frame.minX,
            y: content.isFlipped ? frame.minY : content.bounds.height - frame.maxY,
            width: frame.width,
            height: frame.height
        )
        view.autoresizingMask = [.width, .height]
    }

    // Hidden, the stage and every page on it are out of sight, and take no clicks.
    func show(_ on: Bool) {
        view.isHidden = !on
    }

    func remove() {
        lay([])
        view.removeFromSuperview()
    }

    // The pages on the stage, bottom to top, each at its frame, or hidden: kept out of the window, which a page in it
    // would slow as it resizes. A page with a clip is drawn only inside it, cut there and never resized. A page with an
    // input region takes the pointer only inside it, its rects from the page's top left. A page left out is taken off,
    // from this stage alone: one another stage shows since stays where it is.
    func lay(_ layers: [(page: WebPage, frame: CGRect?, clip: CGRect?, input: [CGRect]?)]) {
        let shown = layers.compactMap { layer in layer.frame.map { (layer.page, $0, layer.clip, layer.input) } }
        let kept = Set(shown.map { ObjectIdentifier($0.0) })
        for page in laid where !kept.contains(ObjectIdentifier(page)) {
            takeOff(page)
        }
        var below: NSView?
        for (page, frame, clip, input) in shown {
            page.view.inputRegion = input
            let item = holder(of: page, frame: frame, clip: clip)
            if item.superview !== view {
                view.addSubview(item, positioned: .above, relativeTo: below)
            } else if let index = view.subviews.firstIndex(of: item),
                index != (below.flatMap { view.subviews.firstIndex(of: $0) }.map { $0 + 1 } ?? 0)
            {
                view.addSubview(item, positioned: .above, relativeTo: below)
            }
            below = item
        }
        laid = shown.map(\.0)
    }

    // MARK: - Private
    // The view laid on the stage for `page`: the page's own, or the clip it is drawn in, each at its frame.
    private func holder(of page: WebPage, frame: CGRect, clip: CGRect?) -> NSView {
        let key = ObjectIdentifier(page)
        guard let clip else {
            dropClip(of: page)
            if page.view.frame != frame { page.view.frame = frame }
            return page.view
        }
        let cut = clips[key] ?? ClipView()
        clips[key] = cut
        if page.view.superview !== cut { cut.addSubview(page.view) }
        if cut.frame != clip { cut.frame = clip }
        let inside = frame.offsetBy(dx: -clip.minX, dy: -clip.minY)
        if page.view.frame != inside { page.view.frame = inside }
        return cut
    }

    private func takeOff(_ page: WebPage) {
        page.view.inputRegion = nil
        if !dropClip(of: page), page.view.superview === view { page.view.removeFromSuperview() }
    }

    // The clip `page` is drawn in taken off, the page out of it. Answers whether it had one.
    @discardableResult
    private func dropClip(of page: WebPage) -> Bool {
        guard let cut = clips.removeValue(forKey: ObjectIdentifier(page)) else { return false }
        if page.view.superview === cut { page.view.removeFromSuperview() }
        cut.removeFromSuperview()
        return true
    }
}

// A stage's view: flipped, so its pages' frames are from its top left.
private final class StageView: NSView {
    override var isFlipped: Bool { true }
}

// What a page is cut to: flipped like the stage, drawing nothing, and taking no clicks where its page is not.
private final class ClipView: NSView {
    override var isFlipped: Bool { true }

    override init(frame: CGRect) {
        super.init(frame: frame)
        clipsToBounds = true
    }

    required init?(coder: NSCoder) { nil }

    override func hitTest(_ point: NSPoint) -> NSView? {
        let hit = super.hitTest(point)
        return hit === self ? nil : hit
    }
}
