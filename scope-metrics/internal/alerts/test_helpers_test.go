package alerts

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestWebhookServer(t *testing.T, requestBodies chan<- string) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatalf("read webhook body: %v", err)
		}

		requestBodies <- string(body)
		writer.WriteHeader(http.StatusAccepted)
	}))
}
