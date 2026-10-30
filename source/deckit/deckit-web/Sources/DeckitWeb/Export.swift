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
    case place
    case load
    case go
    case focus
    case isFocused
    case state
    case run
    case evaluate
    case find
    case fetchText
    case clear
    case close
    case safariVersion
    case tree
}
