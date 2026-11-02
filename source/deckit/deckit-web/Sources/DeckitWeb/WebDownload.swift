//
//  WebDownload.swift
//  DeckitWeb
//
//  Created by JSilver on 11/2/26.
//

import Foundation
import WebKit

// A download a page started, which tells JavaScript what becomes of it: `adopted` ({ id }) first, then asks
// `destination` ({ url, suggestedFilename, mimeType, expectedLength }), answered at once with the path of the file to
// write, or nothing to cancel it; then `progress` ({ received, expected }), `expected` -1 while it is not known, and
// once, `finished` or `failed` ({ description, cancelled }).
@MainActor
final class WebDownload: NSObject {
    // MARK: - Property
    // How often what it received is told, while it downloads.
    private static let progressInterval: TimeInterval = 0.25

    let id: Int
    private let download: WKDownload
    private let emitter: Emitter
    private let ended: @MainActor (WebDownload) -> Void
    private var timer: Timer?
    private var told: (received: Int64, expected: Int64)?

    // MARK: - Initializer
    // `ended` is told once, as it finishes or fails.
    init(id: Int, download: WKDownload, emitter: Emitter, ended: @escaping @MainActor (WebDownload) -> Void) {
        self.id = id
        self.download = download
        self.emitter = emitter
        self.ended = ended
        super.init()
        download.delegate = self
    }

    // MARK: - Public
    // Told once JavaScript has it, so it knows it by its id before anything else.
    func announce() {
        emitter.emit("adopted", ["id": id])
    }

    func cancel() {
        download.cancel { _ in }
    }

    // MARK: - Private
    private func watchProgress() {
        timer = Timer.scheduledTimer(withTimeInterval: Self.progressInterval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tellProgress() }
        }
    }

    private func tellProgress() {
        let progress = download.progress
        let now = (received: progress.completedUnitCount, expected: progress.totalUnitCount)
        guard told.map({ $0 != now }) ?? true else { return }
        told = now
        emitter.emit("progress", ["received": Double(now.received), "expected": Double(now.expected)])
    }

    private func end(_ event: String, _ payload: [String: Any?] = [:]) {
        timer?.invalidate()
        timer = nil
        tellProgress()
        emitter.emit(event, payload)
        emitter.release()
        ended(self)
    }
}

extension WebDownload: WKDownloadDelegate {
    // MARK: - Lifecycle
    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping @MainActor @Sendable (URL?) -> Void
    ) {
        let payload: [String: Any?] = [
            "url": download.originalRequest?.url?.absoluteString ?? response.url?.absoluteString ?? "",
            "suggestedFilename": suggestedFilename,
            "mimeType": response.mimeType ?? "",
            "expectedLength": Double(response.expectedContentLength)
        ]
        let path: String? = emitter.emit("destination", payload) { node, value in try node.string(value) }
        guard let path, !path.isEmpty else {
            completionHandler(nil)
            return
        }

        watchProgress()
        completionHandler(URL(fileURLWithPath: path))
    }

    func downloadDidFinish(_ download: WKDownload) {
        end("finished")
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        let error = error as NSError
        end("failed", [
            "description": error.localizedDescription,
            "cancelled": error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled
        ])
    }
}
