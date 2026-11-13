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
    // A rect on the stage a page is cut to, its corners rounded by `cornerRadius`.
    struct Clip {
        let rect: CGRect
        let cornerRadius: CGFloat
    }

    // What is laid on a stage, bottom to top: a page at its frame, cut to its clips, taking the pointer only inside its
    // input region where it has one, or hidden; or a material at a rect, its corners rounded by `cornerRadius`, that
    // blurs what the window shows under it, the pages laid before it included, and takes no clicks.
    enum Layer {
        case page(WebPage, frame: CGRect?, clips: [Clip], input: [CGRect]?)
        case material(NSVisualEffectView.Material, rect: CGRect, cornerRadius: CGFloat)
    }

    let id: Int
    let view: NSView = StageView()
    private var laid: [WebPage] = [] // the pages it put on screen, in its view or a clip of its own
    private var clips: [ObjectIdentifier: [ClipView]] = [:] // a page -> the clips it is drawn in, outermost first
    private var materials: [MaterialView] = [] // the materials laid, in the order they are, each kept for the next lay

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

    // What is on the stage, bottom to top. A page hidden is kept out of the window, which a page in it would slow as
    // it resizes. A page with clips is drawn only inside each of them, cut there and never resized. A page with an input
    // region takes the pointer only inside it, its rects from the page's top left. A page left out is taken off, from
    // this stage alone: one another stage shows since stays where it is. A material is laid at its place in the order,
    // and those left over are taken off.
    func lay(_ layers: [Layer]) {
        let kept = Set(layers.compactMap { layer -> ObjectIdentifier? in
            guard case let .page(page, frame?, _, _) = layer else { return nil }
            return ObjectIdentifier(page)
        })
        for page in laid where !kept.contains(ObjectIdentifier(page)) {
            takeOff(page)
        }
        var below: NSView?
        var shown: [WebPage] = []
        var used = 0
        for layer in layers {
            let item: NSView
            switch layer {
            case let .page(page, frame, clips, input):
                guard let frame else { continue }
                page.view.inputRegion = input
                item = holder(of: page, frame: frame, clips: clips)
                shown.append(page)

            case let .material(material, rect, cornerRadius):
                if used == materials.count { materials.append(MaterialView()) }
                let made = materials[used]
                used += 1
                made.material = material
                made.cornerRadius = cornerRadius
                if made.frame != rect { made.frame = rect }
                item = made
            }
            if item.superview !== view {
                view.addSubview(item, positioned: .above, relativeTo: below)
            } else if let index = view.subviews.firstIndex(of: item),
                index != (below.flatMap { view.subviews.firstIndex(of: $0) }.map { $0 + 1 } ?? 0)
            {
                view.addSubview(item, positioned: .above, relativeTo: below)
            }
            below = item
        }
        materials[used...].forEach { $0.removeFromSuperview() }
        materials.removeSubrange(used...)
        laid = shown
    }

    // MARK: - Private
    // The view laid on the stage for `page`: the page's own at its frame, or the outermost of the clips it is drawn in,
    // each inside the one before it.
    private func holder(of page: WebPage, frame: CGRect, clips shapes: [Clip]) -> NSView {
        let key = ObjectIdentifier(page)
        guard !shapes.isEmpty else {
            dropClips(of: page)
            if page.view.frame != frame { page.view.frame = frame }
            return page.view
        }
        if clips[key]?.count != shapes.count {
            dropClips(of: page)
            let made = shapes.map { _ in ClipView() }
            zip(made, made.dropFirst()).forEach { $0.addSubview($1) }
            clips[key] = made
        }
        let cuts = clips[key] ?? []
        var origin = CGPoint.zero
        for (cut, shape) in zip(cuts, shapes) {
            let inside = shape.rect.offsetBy(dx: -origin.x, dy: -origin.y)
            if cut.frame != inside { cut.frame = inside }
            cut.cornerRadius = shape.cornerRadius
            origin = shape.rect.origin
        }
        if let last = cuts.last, page.view.superview !== last { last.addSubview(page.view) }
        let inside = frame.offsetBy(dx: -origin.x, dy: -origin.y)
        if page.view.frame != inside { page.view.frame = inside }
        return cuts[0]
    }

    private func takeOff(_ page: WebPage) {
        page.view.inputRegion = nil
        if !dropClips(of: page), page.view.superview === view { page.view.removeFromSuperview() }
    }

    // The clips `page` is drawn in taken off, the page out of them. Answers whether it had any.
    @discardableResult
    private func dropClips(of page: WebPage) -> Bool {
        guard let cuts = clips.removeValue(forKey: ObjectIdentifier(page)) else { return false }
        if page.view.superview === cuts.last { page.view.removeFromSuperview() }
        cuts.first?.removeFromSuperview()
        return true
    }
}

// A stage's view: flipped, so its pages' frames are from its top left.
private final class StageView: NSView {
    override var isFlipped: Bool { true }
}

// A material laid on the stage: it blends within the window, so it blurs what the window shows under it, rounded
// at its corners and taking no clicks.
private final class MaterialView: NSVisualEffectView {
    override var isFlipped: Bool { true }

    var cornerRadius: CGFloat = 0 {
        didSet { layer?.cornerRadius = cornerRadius }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        blendingMode = .withinWindow
        state = .active
        wantsLayer = true
        layer?.masksToBounds = true
    }

    required init?(coder: NSCoder) { nil }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}

// What a page is cut to: flipped like the stage, drawing nothing, and taking no clicks where its page is not, nor
// outside its rounded corners.
private final class ClipView: NSView {
    override var isFlipped: Bool { true }

    var cornerRadius: CGFloat = 0 {
        didSet { layer?.cornerRadius = cornerRadius }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.masksToBounds = true
        clipsToBounds = true
    }

    required init?(coder: NSCoder) { nil }

    override func hitTest(_ point: NSPoint) -> NSView? {
        let inside = convert(point, from: superview)
        if cornerRadius > 0,
            !NSBezierPath(roundedRect: bounds, xRadius: cornerRadius, yRadius: cornerRadius).contains(inside)
        {
            return nil
        }
        let hit = super.hitTest(point)
        return hit === self ? nil : hit
    }
}
