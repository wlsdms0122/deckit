//
//  Export.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation

// The module's functions, as JavaScript names them (WebEngine).
enum Export: Int, CaseIterable {
    case make
    case load
    case go
    case focus
    case isFocused
    case focusedPage
    case state
    case run
    case evaluate
    case find
    case fetch
    case droppedFiles
    case clear
    case close
    case cancelDownload
    case safariVersion
    case fonts
    case openWindow
    case showWindow
    case hideWindow
    case closeWindow
    case windowFrame
    case windowState
    case setWindowFrame
    case windowSize
    case setWindowSize
    case setTitle
    case setColor
    case keyWindow
    case doubleClickTitleBar
    case drag
    case previewFile
    case closeFilePreview
    case showOpenDialog
    case showSaveDialog
    case sendKey
    case sendMouse
    case sendDrop
    case snapshot
    case killProcess
    case pages
    case windows
    case makeStage
    case placeStage
    case layStage
    case showStage
    case removeStage
    case tree
}
