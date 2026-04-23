import XCTest
@testable import AtlasKit

final class APIClientTests: XCTestCase {
    func testEnvelopeDecodingUnwrapsData() async throws {
        let (client, tokens) = makeClient()
        MockURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/core/auth/me")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer access-1")
            let body = #"""
            {
              "data": {
                "id": "11111111-1111-1111-1111-111111111111",
                "username": "louisdo",
                "displayName": "Louis Do",
                "email": "louis@example.com"
              }
            }
            """#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, body)
        }

        await tokens.save(AtlasTokens(accessToken: "access-1", refreshToken: "refresh-1"))
        let user: AtlasUser = try await client.get("/api/core/auth/me")
        XCTAssertEqual(user.username, "louisdo")
        XCTAssertEqual(user.displayName, "Louis Do")
    }

    func testRawJSONAlsoDecodes() async throws {
        let (client, _) = makeClient()
        MockURLProtocol.handler = { request in
            let body = #"""
            [
              {"id":"a","username":"u","displayName":"U"},
              {"id":"b","username":"v","displayName":"V"}
            ]
            """#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, body)
        }

        let users: [AtlasUser] = try await client.get("/api/core/users/search", query: ["q": "u"])
        XCTAssertEqual(users.count, 2)
    }

    func testUnauthorizedMaps401ToAPIError() async throws {
        let (client, _) = makeClient()
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
            return (response, Data())
        }

        do {
            let _: AtlasUser = try await client.get("/api/core/auth/me")
            XCTFail("expected unauthorized error")
        } catch let error as APIError {
            XCTAssertEqual(error, .unauthorized)
        }
    }

    func testServerErrorSurfacesMessage() async throws {
        let (client, _) = makeClient()
        MockURLProtocol.handler = { request in
            let body = #"{"message":"pipeline down"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!
            return (response, body)
        }

        do {
            let _: AtlasUser = try await client.get("/api/core/health")
            XCTFail("expected server error")
        } catch APIError.server(let status, let message) {
            XCTAssertEqual(status, 500)
            XCTAssertEqual(message, "pipeline down")
        }
    }

    // MARK: - Helpers

    private func makeClient() -> (APIClient, InMemoryTokenStore) {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: config)
        let tokens = InMemoryTokenStore()
        let client = APIClient(baseURL: URL(string: "https://atlas.test")!, session: session, tokens: tokens)
        return (client, tokens)
    }
}

final class MockURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let (response, data) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
