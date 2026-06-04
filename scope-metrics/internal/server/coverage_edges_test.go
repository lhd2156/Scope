package server

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"scope-metrics/internal/alerts"
	"scope-metrics/internal/config"
)

type serverRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn serverRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestAlertRulesEndpointReturnsLoadedConfig(t *testing.T) {
	t.Parallel()

	app := New(newTestConfig(t, nil))
	request := httptest.NewRequest(http.MethodGet, "/alerts/rules", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	body := recorder.Body.String()
	for _, expected := range []string{
		"\"rulesLoaded\": true",
		"core-service-down",
		"\"config\": {",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected response body to contain %q, got %s", expected, body)
		}
	}
}

func TestProbeTargetCoversRequestTransportAndHTTPFailureBranches(t *testing.T) {
	app := New(newTestConfig(t, nil))

	badRequest := app.probeTarget(context.Background(), config.Target{Name: "bad-url", URL: "://bad-url"})
	if badRequest.Error == "" || badRequest.Up {
		t.Fatalf("expected malformed URL to fail before transport, got %+v", badRequest)
	}

	app.httpClient = &http.Client{Transport: serverRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return nil, errors.New("connection refused")
	})}
	transportFailure := app.probeTarget(context.Background(), config.Target{Name: "transport", URL: "http://transport.test/healthz"})
	if transportFailure.Error == "" || transportFailure.Up {
		t.Fatalf("expected transport failure to mark probe down, got %+v", transportFailure)
	}

	forwardedProto := ""
	app.httpClient = &http.Client{Transport: serverRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		forwardedProto = request.Header.Get("X-Forwarded-Proto")
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader("{}")),
			Header:     make(http.Header),
		}, nil
	})}
	success := app.probeTarget(context.Background(), config.Target{Name: "content", URL: "http://content.test/healthz"})
	if !success.Up || forwardedProto != "https" {
		t.Fatalf("expected successful probe with forwarded proto header, got result=%+v proto=%q", success, forwardedProto)
	}

	app.httpClient = &http.Client{Transport: serverRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusTeapot,
			Body:       io.NopCloser(strings.NewReader("nope")),
			Header:     make(http.Header),
		}, nil
	})}
	httpFailure := app.probeTarget(context.Background(), config.Target{Name: "teapot", URL: "http://teapot.test/healthz"})
	if httpFailure.Up || httpFailure.StatusCode != http.StatusTeapot {
		t.Fatalf("expected non-2xx response to mark probe down, got %+v", httpFailure)
	}
}

func TestRefreshAndAlertMetricBranches(t *testing.T) {
	app := New(newTestConfig(t, []config.Target{{Name: "bad-url", URL: "://bad-url"}}))

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	result := app.collectRefreshSnapshot(ctx)
	if result.snapshot.LastRefreshSuccess {
		t.Fatalf("expected invalid probe to make refresh fail, got %+v", result.snapshot)
	}

	app.ruleSet = nil
	app.evaluateAlerts(result.snapshot, true)
	if app.activeAlerts != nil {
		t.Fatalf("expected nil ruleset to clear active alerts, got %+v", app.activeAlerts)
	}

	app = New(newTestConfig(t, nil))
	app.evaluateAlerts(refreshSnapshot{LastRefreshSuccess: false, Errors: []string{"manual refresh failure"}}, false)
	if len(app.activeAlerts) == 0 {
		t.Fatal("expected dispatch=false evaluation to keep active alerts without dispatching")
	}

	app.recordDispatchMetrics(alerts.DispatchResult{WebhookURL: "http://webhook.test", Attempted: true, Delivered: true})
	app.recordDispatchMetrics(alerts.DispatchResult{WebhookURL: "http://webhook.test", Attempted: true, Delivered: false})
	app.recordDispatchMetrics(alerts.DispatchResult{Attempted: false})
}
