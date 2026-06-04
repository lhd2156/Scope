package alerts

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestDispatcherCooldownForceInvalidURLAndServerErrors(t *testing.T) {
	dispatcher := NewDispatcher(DispatcherConfig{WebhookURL: "://bad-url", Source: "test"}, time.Second)
	alert := EvaluatedAlert{ID: "cooldown", Summary: "Cooldown", Severity: "warning", Observed: "bad", Cooldown: "not-a-duration"}

	first := dispatcher.Process(t.Context(), []EvaluatedAlert{alert}, false)
	if !first.Attempted || first.Error == "" || !strings.Contains(first.Error, "build webhook request") {
		t.Fatalf("expected invalid URL error, got %+v", first)
	}

	second := dispatcher.Process(t.Context(), []EvaluatedAlert{alert}, false)
	if len(second.Alerts) != 1 {
		t.Fatalf("invalid cooldown should allow immediate redispatch, got %+v", second)
	}

	requestBodies := make(chan string, 2)
	server := newTestWebhookServerWithStatus(t, requestBodies, 500)
	httpDispatcher := NewDispatcher(DispatcherConfig{WebhookURL: server.URL, BearerToken: "token", Source: "test"}, time.Second)
	failed := httpDispatcher.Process(t.Context(), []EvaluatedAlert{alert}, true)
	if !failed.Attempted || failed.Delivered || !strings.Contains(failed.Error, "status 500") {
		t.Fatalf("expected webhook status failure, got %+v", failed)
	}
}

func newTestWebhookServerWithStatus(t *testing.T, requestBodies chan<- string, status int) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatalf("read webhook body: %v", err)
		}

		requestBodies <- string(body)
		writer.WriteHeader(status)
	}))
}
