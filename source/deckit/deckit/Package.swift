// swift-tools-version: 6.3

import PackageDescription

let package = Package(
    name: "Deckit",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(name: "Deck", targets: ["Deck"]),
        .library(name: "Deckit", targets: ["Deckit"]),
        .executable(name: "deckit", targets: ["DeckitServer"])
    ],
    targets: [
        .target(name: "Deck"),
        .target(
            name: "Deckit",
            dependencies: [
                "Deck"
            ]
        ),
        .executableTarget(
            name: "DeckitServer",
            dependencies: [
                "Deck",
                "Deckit"
            ]
        ),
        .testTarget(
            name: "DeckTests",
            dependencies: [
                "Deck"
            ]
        ),
        .testTarget(
            name: "DeckitTests",
            dependencies: [
                "Deck",
                "Deckit"
            ]
        ),
        .testTarget(
            name: "DeckitHostTests",
            dependencies: [
                "Deck",
                "Deckit"
            ]
        ),
        .testTarget(
            name: "DeckitServerTests",
            dependencies: [
                "DeckitServer"
            ],
            resources: [
                .copy("Golden")
            ]
        )
    ],
    swiftLanguageModes: [.v6]
)
