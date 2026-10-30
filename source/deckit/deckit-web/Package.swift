// swift-tools-version: 6.3

import PackageDescription

let package = Package(
    name: "DeckitWeb",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "DeckitWeb", type: .dynamic, targets: ["DeckitWeb"])
    ],
    targets: [
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
        )
    ],
    swiftLanguageModes: [.v6]
)
