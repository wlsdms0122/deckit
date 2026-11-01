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
    case fetchText
    case clear
    case close
    case safariVersion
    case openWindow
    case showWindow
    case hideWindow
    case closeWindow
    case windowFrame
    case setWindowFrame
    case windowSize
    case setWindowSize
    case setTitle
    case setColor
    case keyWindow
    case doubleClickTitleBar
    case drag
    case makeStage
    case placeStage
    case layStage
    case removeStage
    case tree
}
