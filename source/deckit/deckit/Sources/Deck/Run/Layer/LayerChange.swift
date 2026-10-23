//
//  LayerChange.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a layer on deck tells has changed of its own, which deck carries to the driver after the runs' effects and does
// not read.
public protocol LayerChange: Sendable {}
