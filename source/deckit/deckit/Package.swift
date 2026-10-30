// swift-tools-version: 6.3

import PackageDescription

let package = Package(
    name: "Deckit",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "Deck", targets: ["Deck"]),
        .library(name: "Deckit", targets: ["Deckit"]),
        .executable(name: "deckit", targets: ["DeckitServer"]),
        .library(name: "DeckitWeb", type: .dynamic, targets: ["DeckitWeb"])
    ],
    targets: [
        .target(name: "Deck"),
        // Node-API's headers alone: a module that Node loads finds the functions in the process that loads it.
        .systemLibrary(name: "CNodeAPI"),
        .target(
            name: "DeckitWeb",
            dependencies: [
                "CNodeAPI"
            ],
            linkerSettings: [
                .unsafeFlags(["-Xlinker", "-undefined", "-Xlinker", "dynamic_lookup"])
            ]
        ),
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
