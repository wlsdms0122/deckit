//
//  Hole.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import Foundation

// Where the mod's page draws over a web page: a rect, with the radius of its corners.
struct Hole: Equatable {
    // MARK: - Property
    let rect: CGRect
    let radius: CGFloat

    // MARK: - Initializer
    // MARK: - Public
    func offsetBy(dx: CGFloat, dy: CGFloat) -> Hole {
        Hole(rect: rect.offsetBy(dx: dx, dy: dy), radius: radius)
    }

    // MARK: - Private
}
