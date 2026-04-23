import Foundation

public enum APIError: LocalizedError, Equatable, Sendable {
    case invalidURL
    case transport(String)
    case decoding(String)
    case unauthorized
    case forbidden
    case notFound
    case conflict(String)
    case server(status: Int, message: String)
    case unknown

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The request URL was invalid."
        case .transport(let message):
            return "Network error: \(message)"
        case .decoding(let message):
            return "Could not read the server response: \(message)"
        case .unauthorized:
            return "Your session has expired. Please sign in again."
        case .forbidden:
            return "You don't have permission to do that."
        case .notFound:
            return "We couldn't find what you were looking for."
        case .conflict(let message):
            return message
        case .server(_, let message):
            return message
        case .unknown:
            return "Something went wrong. Please try again."
        }
    }
}
