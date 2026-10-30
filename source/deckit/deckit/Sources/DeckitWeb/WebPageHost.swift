//
//  WebPageHost.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import AppKit
import QuartzCore

// What holds a web page over the view of Chromium's that draws its mod's page, filling that view as Chromium sizes its
// subviews: the page is at its frame in it, and where the mod's page draws over the web page, a hole is cut in it,
// through which the mod's page shows. The mouse passes to the mod's page everywhere but on the web page.
@MainActor
final class WebPageHost: NSView {
    // MARK: - Property
    private let content: NSView
    private var holes: [Hole] = []
    private let mask = CAShapeLayer()

    override var isFlipped: Bool { true }

    // MARK: - Initializer
    init(content: NSView) {
        self.content = content
        super.init(frame: .zero)
        wantsLayer = true
        autoresizesSubviews = false
        mask.fillRule = .evenOdd
        addSubview(content)
    }

    required init?(coder: NSCoder) {
        nil
    }

    // MARK: - Lifecycle
    override func setFrameSize(_ size: NSSize) {
        super.setFrameSize(size)
        cutMask()
    }

    // `point` is in the superview's space.
    override func hitTest(_ point: NSPoint) -> NSView? {
        let local = convert(point, from: superview)
        guard content.frame.contains(local), !holes.contains(where: { $0.rect.contains(local) }) else { return nil }

        return super.hitTest(point)
    }

    // MARK: - Public
    // `frame` and `holes` are in this view's space, from its top left.
    func lay(_ frame: CGRect, holes: [Hole]) {
        let holes = holes.map { $0.offsetBy(dx: frame.minX, dy: frame.minY) }
        guard frame != content.frame || holes != self.holes else { return }
        content.frame = frame
        self.holes = holes
        cutMask()
    }

    // MARK: - Private
    private func cutMask() {
        guard let layer else { return }

        let path = CGMutablePath()
        for hole in [Hole(rect: content.frame, radius: 0)] + holes {
            let rect = layer.isGeometryFlipped ? hole.rect : CGRect(
                x: hole.rect.minX,
                y: layer.bounds.height - hole.rect.maxY,
                width: hole.rect.width,
                height: hole.rect.height
            )
            let radius = min(hole.radius, rect.width / 2, rect.height / 2)
            path.addRoundedRect(in: rect, cornerWidth: radius, cornerHeight: radius)
        }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        mask.frame = layer.bounds
        mask.path = path
        layer.mask = mask
        CATransaction.commit()
    }
}
