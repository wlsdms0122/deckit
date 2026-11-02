//
//  FilePreview.swift
//  DeckitWeb
//
//  Created by JSilver on 11/1/26.
//

import AppKit
import Quartz

// A file Quick Look's panel shows, titled `title`: the one item the panel is handed while a window controls it.
final class FilePreview: NSObject, QLPreviewItem, QLPreviewPanelDataSource {
    // MARK: - Property
    let previewItemURL: URL!
    let previewItemTitle: String!

    // MARK: - Initializer
    init(file: URL, title: String) {
        previewItemURL = file
        previewItemTitle = title
    }

    // MARK: - Lifecycle
    func numberOfPreviewItems(in panel: QLPreviewPanel!) -> Int {
        1
    }

    func previewPanel(_ panel: QLPreviewPanel!, previewItemAt index: Int) -> (any QLPreviewItem)! {
        self
    }

    // MARK: - Public
    // MARK: - Private
}
