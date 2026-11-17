//
//  Capture.swift
//  DeckitWeb
//
//  Created by JSilver on 11/15/26.
//

import AppKit
import CoreImage
import WebKit

// A picture of pages as layers have them, bottom to top, made from what each page draws and from no window: so the
// order may be one that is not shown, and a page under another is drawn whole. A page is cut to its clips and drawn
// at its opacity and scale; a material is drawn as on a screen, what the picture has under it so far blurred within
// its rect, rounded at its corners; a hidden page and a page that draws nothing leave nothing in the picture.
@MainActor
enum Capture {
    // MARK: - Property
    // How far a material blurs what is under it, in points: the deviation of the gaussian blur the host's materials
    // show to the eye, behind the window and within it alike.
    static let blur: CGFloat = 30

    private static let images = CIContext(options: [.cacheIntermediates: false])

    // What is gathered while the pages draw.
    private final class Pending {
        var drawn: [Int: CGImage] = [:] // a layer's index -> what its page drew
        var waiting = 0
    }

    // MARK: - Initializer
    // MARK: - Public
    // `rect` of the layers' stage as PNG, `scale` pixels a point, clear where nothing draws.
    static func take(
        _ layers: [Stage.Layer],
        rect: CGRect,
        scale: CGFloat,
        done: @escaping @MainActor (Result<Data, Error>) -> Void
    ) {
        let pending = Pending()
        let pages = layers.enumerated().compactMap { index, layer -> (Int, WebPage)? in
            guard case let .page(page, frame: frame?, clips: _, input: _, opacity: opacity, scale: _) = layer,
                  opacity > 0, frame.width > 0, frame.height > 0 else {
                return nil
            }

            return (index, page)
        }
        guard !pages.isEmpty else { return done(compose(layers, pending.drawn, rect: rect, scale: scale)) }

        pending.waiting = pages.count
        for (index, page) in pages {
            page.view.takeSnapshot(with: nil) { image, _ in
                MainActor.assumeIsolated {
                    pending.drawn[index] = image?.cgImage(forProposedRect: nil, context: nil, hints: nil)
                    pending.waiting -= 1
                    if pending.waiting == 0 { done(compose(layers, pending.drawn, rect: rect, scale: scale)) }
                }
            }
        }
    }

    // MARK: - Private
    private static func compose(
        _ layers: [Stage.Layer],
        _ drawn: [Int: CGImage],
        rect: CGRect,
        scale: CGFloat
    ) -> Result<Data, Error> {
        let width = Int((rect.width * scale).rounded())
        let height = Int((rect.height * scale).rounded())
        guard width > 0, height > 0, let space = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(
                  data: nil,
                  width: width,
                  height: height,
                  bitsPerComponent: 8,
                  bytesPerRow: 0,
                  space: space,
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              ) else {
            return .failure(NodeError(message: "a picture is of a rect with a size"))
        }

        // Counted as the stage counts: from the rect's top left, y down.
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: scale, y: -scale)
        context.translateBy(x: -rect.minX, y: -rect.minY)
        for (index, layer) in layers.enumerated() {
            if case let .material(_, rect: laid, cornerRadius: cornerRadius) = layer {
                blur(context, under: laid, cornerRadius: cornerRadius, of: rect, scale: scale)
                continue
            }
            guard let image = drawn[index],
                  case let .page(_, frame: frame?, clips: clips, input: _, opacity: opacity, scale: scaled) = layer
            else {
                continue
            }

            context.saveGState()
            if let scaled {
                context.translateBy(x: scaled.x, y: scaled.y)
                context.scaleBy(x: scaled.by, y: scaled.by)
            }
            for clip in clips {
                let radius = max(0, min(clip.cornerRadius, clip.rect.width / 2, clip.rect.height / 2))
                context.addPath(
                    CGPath(roundedRect: clip.rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
                )
                context.clip()
            }
            context.setAlpha(opacity)
            context.translateBy(x: frame.minX, y: frame.maxY)
            context.scaleBy(x: 1, y: -1)
            context.draw(image, in: CGRect(origin: .zero, size: frame.size))
            context.restoreGState()
        }
        guard let picture = context.makeImage(),
              let png = NSBitmapImageRep(cgImage: picture).representation(using: .png, properties: [:]) else {
            return .failure(NodeError(message: "the picture could not be made"))
        }

        return .success(png)
    }

    // What `context`, the picture of `rect` at `scale`, has drawn so far drawn again blurred, within `laid` rounded by
    // `cornerRadius`; its edges are blurred as though what is at them went on past them.
    private static func blur(
        _ context: CGContext,
        under laid: CGRect,
        cornerRadius: CGFloat,
        of rect: CGRect,
        scale: CGFloat
    ) {
        guard laid.intersects(rect), let drawn = context.makeImage() else { return }
        let source = CIImage(cgImage: drawn)
        let blurred = source.clampedToExtent().applyingGaussianBlur(sigma: Double(blur * scale))
        guard let image = images.createCGImage(blurred, from: source.extent) else { return }

        context.saveGState()
        let radius = max(0, min(cornerRadius, laid.width / 2, laid.height / 2))
        context.addPath(CGPath(roundedRect: laid, cornerWidth: radius, cornerHeight: radius, transform: nil))
        context.clip()
        context.setBlendMode(.copy)
        context.translateBy(x: rect.minX, y: rect.maxY)
        context.scaleBy(x: 1, y: -1)
        context.draw(image, in: CGRect(origin: .zero, size: rect.size))
        context.restoreGState()
    }
}
