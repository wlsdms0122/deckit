//
//  Sandbox.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Where a principal runs, run after run, while its job keeps its revision.
final class Sandbox {
    // MARK: - Property
    let job: Job
    // Its latest run.
    var run: Run
    var stopAsked = false
    var state: RunState {
        run.state
    }

    // MARK: - Initializer
    init(job: Job, run: Run) {
        self.job = job
        self.run = run
    }

    // MARK: - Public
    // MARK: - Private
}
