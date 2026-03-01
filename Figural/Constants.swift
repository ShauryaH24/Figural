import Foundation

enum Constants {
    /// Replace with your Anthropic API key from console.anthropic.com
    static let anthropicAPIKey: String = ""
    
    static let anthropicAPIURL = "https://api.anthropic.com/v1/messages"
    static let anthropicModel = "claude-opus-4-5"
    static let anthropicVersion = "2023-06-01"
    static let maxTokens = 4096
}
