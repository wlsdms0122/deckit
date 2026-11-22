//
//  PickerAsk.swift
//  DeckitWeb
//
//  Created by JSilver on 11/22/26.
//

import Foundation

// What a control of a page asks of its picker, as deckit's script posts it: its options in order and its rect in its
// frame, each as JavaScript is told it.
struct PickerAsk: Decodable {
    struct Option: Decodable {
        // MARK: - Property
        let label: String
        // The label of the group the option is in, or nil for none.
        let group: String?
        let disabled: Bool
        let selected: Bool

        var value: [String: Any?] {
            ["label": label, "group": group, "disabled": disabled, "selected": selected]
        }
    }

    struct Rect: Decodable {
        // MARK: - Property
        let x: Double
        let y: Double
        let width: Double
        let height: Double

        var value: [String: Any?] {
            ["x": x, "y": y, "width": width, "height": height]
        }
    }

    // MARK: - Property
    let options: [Option]
    let rect: Rect
}
