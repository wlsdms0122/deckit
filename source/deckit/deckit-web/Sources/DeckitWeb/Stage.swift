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
    private var laid: [WebPage] = []

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
    // would slow as it resizes. A page left out is taken off.
    func lay(_ layers: [(page: WebPage, frame: CGRect?)]) {
        let shown = layers.compactMap { layer in layer.frame.map { (layer.page, $0) } }
        let kept = Set(shown.map { ObjectIdentifier($0.0) })
        for page in laid where !kept.contains(ObjectIdentifier(page)) {
            page.view.removeFromSuperview()
        }
        var below: NSView?
        for (page, frame) in shown {
            if page.view.superview !== view {
                view.addSubview(page.view, positioned: .above, relativeTo: below)
            } else if let index = view.subviews.firstIndex(of: page.view),
                index != (below.flatMap { view.subviews.firstIndex(of: $0) }.map { $0 + 1 } ?? 0)
            {
                view.addSubview(page.view, positioned: .above, relativeTo: below)
            }
            if page.view.frame != frame { page.view.frame = frame }
            below = page.view
        }
        laid = layers.map(\.page)
    }

    // MARK: - Private
}

// A stage's view: flipped, so its pages' frames are from its top left.
private final class StageView: NSView {
    override var isFlipped: Bool { true }
}
