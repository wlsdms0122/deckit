// swift-tools-version: 6.3

import PackageDescription

let package = Package(
    name: "Deckit",
    platforms: [
        .macOS(.v13)
    ],
    products: [
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
            name: "DeckitServerTests",
            dependencies: [
                "DeckitServer"
            ]
        )
    ],
    swiftLanguageModes: [.v6]
)
