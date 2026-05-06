import Foundation

/// Thin wrapper around `URLSession` that understands the Scope `ApiResponse<T>`
/// envelope (Core) and the Django/Flask `{ data: ... }` envelope (Content/Intel).
/// It attaches JWT bearer tokens on every request and transparently refreshes
/// them on `401 Unauthorized`.
public actor APIClient {
    public let baseURL: URL
    private let session: URLSession
    private let tokens: any TokenStoring
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let refresh: (@Sendable () async throws -> ScopeTokens)?
    private var refreshTask: Task<ScopeTokens, Error>?

    public init(
        baseURL: URL,
        session: URLSession = .shared,
        tokens: any TokenStoring,
        refresh: (@Sendable () async throws -> ScopeTokens)? = nil
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokens = tokens
        self.refresh = refresh

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder
    }

    // MARK: - Public surface

    public func get<R: Decodable & Sendable>(
        _ path: String,
        query: [String: String] = [:],
        as: R.Type = R.self
    ) async throws -> R {
        try await send(method: "GET", path: path, query: query, body: Optional<EmptyBody>.none)
    }

    public func post<B: Encodable & Sendable, R: Decodable & Sendable>(
        _ path: String,
        body: B,
        query: [String: String] = [:],
        as: R.Type = R.self
    ) async throws -> R {
        try await send(method: "POST", path: path, query: query, body: body)
    }

    public func put<B: Encodable & Sendable, R: Decodable & Sendable>(
        _ path: String,
        body: B,
        query: [String: String] = [:],
        as: R.Type = R.self
    ) async throws -> R {
        try await send(method: "PUT", path: path, query: query, body: body)
    }

    public func delete<R: Decodable & Sendable>(
        _ path: String,
        query: [String: String] = [:],
        as: R.Type = R.self
    ) async throws -> R {
        try await send(method: "DELETE", path: path, query: query, body: Optional<EmptyBody>.none)
    }

    // MARK: - Request pipeline

    private struct EmptyBody: Encodable, Sendable {}

    private func send<B: Encodable & Sendable, R: Decodable & Sendable>(
        method: String,
        path: String,
        query: [String: String],
        body: B?
    ) async throws -> R {
        let request = try await buildRequest(method: method, path: path, query: query, body: body, retry: false)
        let (data, response) = try await perform(request)

        if let http = response as? HTTPURLResponse, http.statusCode == 401, refresh != nil {
            _ = try await refreshTokens()
            let retried = try await buildRequest(method: method, path: path, query: query, body: body, retry: true)
            let (retryData, retryResponse) = try await perform(retried)
            return try decode(data: retryData, response: retryResponse)
        }

        return try decode(data: data, response: response)
    }

    private func buildRequest<B: Encodable & Sendable>(
        method: String,
        path: String,
        query: [String: String],
        body: B?,
        retry: Bool
    ) async throws -> URLRequest {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )
        if !query.isEmpty {
            components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("scope-ios/1.0", forHTTPHeaderField: "User-Agent")

        if let body = body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        if let tokens = await tokens.load() {
            request.setValue("Bearer \(tokens.accessToken)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
    }

    private func decode<R: Decodable & Sendable>(data: Data, response: URLResponse) throws -> R {
        guard let http = response as? HTTPURLResponse else { throw APIError.unknown }
        switch http.statusCode {
        case 200..<300:
            return try decodeEnvelope(data)
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 409:
            throw APIError.conflict(message(from: data) ?? "Conflict")
        default:
            throw APIError.server(status: http.statusCode, message: message(from: data) ?? "Server error")
        }
    }

    private func decodeEnvelope<R: Decodable>(_ data: Data) throws -> R {
        // Handle 204 No Content / truly empty bodies for generic `Empty` responses.
        if data.isEmpty, let empty = Empty() as? R { return empty }

        do {
            let envelope = try decoder.decode(ApiEnvelope<R>.self, from: data)
            if let inner = envelope.data { return inner }
        } catch {
            // Fall through to raw decode.
        }

        do {
            return try decoder.decode(R.self, from: data)
        } catch {
            throw APIError.decoding(error.localizedDescription)
        }
    }

    private func message(from data: Data) -> String? {
        if let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let message = dict["message"] as? String { return message }
            if let detail = dict["detail"] as? String { return detail }
            if let inner = dict["data"] as? [String: Any], let msg = inner["message"] as? String { return msg }
        }
        return nil
    }

    private func refreshTokens() async throws -> ScopeTokens {
        if let existing = refreshTask { return try await existing.value }
        guard let refresh = refresh else { throw APIError.unauthorized }

        let task = Task { [refresh] in try await refresh() }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }
}

/// Response envelope shared across all Scope backends.
public struct ApiEnvelope<T: Decodable>: Decodable {
    public let data: T?
    public let meta: ScopeMeta?
}

public struct ScopeMeta: Decodable, Sendable {
    public let page: Int?
    public let pageSize: Int?
    public let total: Int?
    public let totalPages: Int?
}

public struct Empty: Codable, Sendable {
    public init() {}
}
