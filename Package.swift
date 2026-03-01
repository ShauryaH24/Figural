// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Figural",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "Figural",
            targets: ["Figural"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/facebook/meta-wearables-dat-ios", from: "0.4.0")
    ],
    targets: [
        .target(
            name: "Figural",
            dependencies: [
                .product(name: "MWDATCore", package: "meta-wearables-dat-ios"),
                .product(name: "MWDATCamera", package: "meta-wearables-dat-ios")
            ],
            path: "Figural"
        )
    ]
)
