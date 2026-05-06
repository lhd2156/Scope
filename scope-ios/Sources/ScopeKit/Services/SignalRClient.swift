import Foundation

/// Minimal SignalR JSON-protocol client built on top of `URLSessionWebSocketTask`.
///
/// Scope Core uses SignalR for notifications, friend-request pushes, and
/// live trip location broadcasts. This client:
/// - Performs the JSON-protocol handshake
/// - Emits a `SignalRInvocation` per hub method into a subscriber's stream
/// - Responds to keep-alive pings automatically
///
/// > Note: This is intentionally dependency-free. For a fully-featured client,
/// > drop in `moozzyk/SignalR-Client-Swift` and adapt `CoreService` callers.
public actor SignalRClient {
    public let hubURL: URL
    private let tokens: any TokenStoring
    private let session: URLSession
    private var task: URLSessionWebSocketTask?
    private var streams: [String: AsyncStream<SignalRInvocation>.Continuation] = [:]

    private static let recordSeparator: Character = "\u{1E}"

    public init(hubURL: URL, tokens: any TokenStoring, session: URLSession = .shared) {
        self.hubURL = hubURL
        self.tokens = tokens
        self.session = session
    }

    public func connect() async throws {
        var request = URLRequest(url: hubURL)
        if let current = await tokens.load() {
            request.setValue("Bearer \(current.accessToken)", forHTTPHeaderField: "Authorization")
        }
        let task = session.webSocketTask(with: request)
        task.resume()
        self.task = task

        try await send(object: ["protocol": "json", "version": 1])
        Task { [weak self] in await self?.readLoop() }
    }

    public func disconnect() async {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        for continuation in streams.values { continuation.finish() }
        streams.removeAll()
    }

    public func subscribe(to method: String) -> AsyncStream<SignalRInvocation> {
        AsyncStream { continuation in
            Task { await self.register(method: method, continuation: continuation) }
        }
    }

    public func invoke(method: String, arguments: [String]) async throws {
        try await send(object: [
            "type": 1,
            "target": method,
            "arguments": arguments
        ])
    }

    // MARK: - Internals

    private func register(method: String, continuation: AsyncStream<SignalRInvocation>.Continuation) {
        streams[method] = continuation
    }

    private func send(object: [String: Any]) async throws {
        let data = try JSONSerialization.data(withJSONObject: object)
        var string = String(data: data, encoding: .utf8) ?? "{}"
        string.append(Self.recordSeparator)
        try await task?.send(.string(string))
    }

    private func readLoop() async {
        guard let task else { return }
        while !Task.isCancelled {
            do {
                let message = try await task.receive()
                switch message {
                case .string(let raw): handle(raw: raw)
                case .data(let data): if let raw = String(data: data, encoding: .utf8) { handle(raw: raw) }
                @unknown default: break
                }
            } catch {
                await disconnect()
                return
            }
        }
    }

    private func handle(raw: String) {
        for frame in raw.split(separator: Self.recordSeparator) where !frame.isEmpty {
            guard let data = frame.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { continue }

            let type = object["type"] as? Int ?? 0
            if type == 1 {
                let target = object["target"] as? String ?? ""
                let argumentsPayload: Data
                if let arguments = object["arguments"] {
                    argumentsPayload = (try? JSONSerialization.data(withJSONObject: arguments)) ?? Data()
                } else {
                    argumentsPayload = Data()
                }
                streams[target]?.yield(SignalRInvocation(target: target, argumentsJSON: argumentsPayload))
            } else if type == 6 {
                Task { [weak self] in try? await self?.send(object: ["type": 6]) }
            }
        }
    }
}

public struct SignalRInvocation: Sendable {
    public let target: String
    /// Raw JSON array of arguments (e.g. `[{"id":"…","type":"friend.request"}]`).
    public let argumentsJSON: Data

    public func decodeFirst<T: Decodable>(as type: T.Type, decoder: JSONDecoder = .init()) throws -> T? {
        if argumentsJSON.isEmpty { return nil }
        let items = try decoder.decode([T].self, from: argumentsJSON)
        return items.first
    }
}
