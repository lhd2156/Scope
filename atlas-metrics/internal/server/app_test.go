package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"atlas-metrics/internal/config"
)

func TestIndexRouteReturnsConfiguredTargets(t *testing.T) {
	t.Parallel()

	app := New(newTestConfig(t, []config.Target{
		{Name: "core", URL: "http://core:8080/api/core/health"},
		{Name: "content", URL: "http://content:8000/api/content/health"},
	}))

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	body := recorder.Body.String()
	for _, expected := range []string{
		"atlas-metrics",
		"0.1.0-test",
		"25.5",
		"http://core:8080/api/core/health",
		"http://content:8000/api/content/health",
		"lastRefreshSuccess",
		"ruleCount",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected response body to contain %q, got %s", expected, body)
		}
	}
}

func TestHealthRouteReturnsOk(t *testing.T) {
	t.Parallel()

	app := New(newTestConfig(t, nil))

	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	if !strings.Contains(recorder.Body.String(), "\"status\": \"ok\"") {
		t.Fatalf("expected health response body to report ok, got %s", recorder.Body.String())
	}
}

func TestMetricsRouteExposesBuildInfoMetric(t *testing.T) {
	t.Parallel()

	app := New(newTestConfig(t, nil))

	request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	body := recorder.Body.String()
	for _, expected := range []string{
		"atlas_metrics_build_info",
		"atlas_metrics_start_time_seconds",
		"atlas_system_cpu_percent",
		"atlas_metrics_http_requests_total",
		"atlas_alert_rules_loaded",
		"atlas_alert_dispatch_total",
		"0.1.0-test",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected metrics body to contain %q, got %s", expected, body)
		}
	}
}

func TestIndexRouteReportsHealthyProbeTargets(t *testing.T) {
	t.Parallel()

	targetServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte(`{"status":"ok"}`))
	}))
	defer targetServer.Close()

	app := New(newTestConfig(t, []config.Target{
		{Name: "intel", URL: targetServer.URL},
	}))

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	body := recorder.Body.String()
	for _, expected := range []string{
		targetServer.URL,
		"\"up\": true",
		"\"statusCode\": 200",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected response body to contain %q, got %s", expected, body)
		}
	}
}

func TestAlertDispatchEndpointReportsDisabledWebhook(t *testing.T) {
	t.Parallel()

	app := New(newTestConfig(t, nil))
	request := httptest.NewRequest(http.MethodPost, "/alerts/dispatch", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	body := recorder.Body.String()
	for _, expected := range []string{
		"dispatch",
		"\"enabled\": false",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected response body to contain %q, got %s", expected, body)
		}
	}
}

func TestAlertRulesEndpointHandlesLoadErrors(t *testing.T) {
	t.Parallel()

	cfg := newTestConfig(t, nil)
	cfg.AlertRulesPath = filepath.Join(t.TempDir(), "missing-alert-rules.yaml")

	app := New(cfg)
	request := httptest.NewRequest(http.MethodGet, "/alerts/rules", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	body := recorder.Body.String()
	for _, expected := range []string{
		"\"rulesLoaded\": false",
		"missing-alert-rules.yaml",
		"loadError",
		"\"config\": null",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected response body to contain %q, got %s", expected, body)
		}
	}
}

func TestAlertDispatchEndpointOnlyDispatchesOncePerRequest(t *testing.T) {
	t.Parallel()

	requestBodies := make(chan string, 4)
	webhookServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatalf("read webhook body: %v", err)
		}

		requestBodies <- string(body)
		writer.WriteHeader(http.StatusAccepted)
	}))
	defer webhookServer.Close()

	targetServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer targetServer.Close()

	cfg := newTestConfig(t, []config.Target{
		{Name: "core", URL: targetServer.URL},
	})
	cfg.AlertWebhookURL = webhookServer.URL

	app := New(cfg)
	request := httptest.NewRequest(http.MethodPost, "/alerts/dispatch", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	receivedBodies := make([]string, 0, 2)
	timeout := time.After(250 * time.Millisecond)
collectBodies:
	for {
		select {
		case body := <-requestBodies:
			receivedBodies = append(receivedBodies, body)
		case <-timeout:
			break collectBodies
		}
	}

	if len(receivedBodies) != 1 {
		t.Fatalf("expected exactly 1 webhook request, got %d", len(receivedBodies))
	}

	for _, expected := range []string{
		"core-service-down",
		"refresh-failed",
		"\"status\":\"firing\"",
	} {
		if !strings.Contains(receivedBodies[0], expected) {
			t.Fatalf("expected webhook payload to contain %q, got %s", expected, receivedBodies[0])
		}
	}
}

func TestHealthRouteReusesCachedRefreshWithinRefreshInterval(t *testing.T) {
	t.Parallel()

	var hitCount atomic.Int32
	targetServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		hitCount.Add(1)
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte(`{"status":"ok"}`))
	}))
	defer targetServer.Close()

	cfg := newTestConfig(t, []config.Target{
		{Name: "core", URL: targetServer.URL},
	})
	cfg.RefreshInterval = time.Hour

	app := New(cfg)
	handler := app.Handler()

	for index := 0; index < 2; index++ {
		request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)

		if recorder.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", recorder.Code)
		}
	}

	if hitCount.Load() != 1 {
		t.Fatalf("expected probe target to be hit exactly once within refresh interval, got %d", hitCount.Load())
	}
}

func TestHealthRouteRefreshesAgainAfterRefreshIntervalExpires(t *testing.T) {
	t.Parallel()

	var hitCount atomic.Int32
	targetServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		hitCount.Add(1)
		writer.WriteHeader(http.StatusOK)
	}))
	defer targetServer.Close()

	cfg := newTestConfig(t, []config.Target{
		{Name: "core", URL: targetServer.URL},
	})
	cfg.RefreshInterval = 20 * time.Millisecond

	app := New(cfg)
	handler := app.Handler()

	firstRequest := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	firstRecorder := httptest.NewRecorder()
	handler.ServeHTTP(firstRecorder, firstRequest)

	time.Sleep(40 * time.Millisecond)

	secondRequest := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	secondRecorder := httptest.NewRecorder()
	handler.ServeHTTP(secondRecorder, secondRequest)

	if firstRecorder.Code != http.StatusOK || secondRecorder.Code != http.StatusOK {
		t.Fatalf("expected both requests to return 200, got %d and %d", firstRecorder.Code, secondRecorder.Code)
	}

	if hitCount.Load() < 2 {
		t.Fatalf("expected refresh to run again after interval expiry, got %d probe hits", hitCount.Load())
	}
}

func newTestConfig(t *testing.T, targets []config.Target) config.Config {
	t.Helper()

	tempDirectory := t.TempDir()
	rulesPath := filepath.Join(tempDirectory, "alert-rules.yaml")
	if err := os.WriteFile(rulesPath, []byte(`
version: 1
defaults:
  severity: warning
  cooldown: 5m
rules:
  - id: core-service-down
    summary: Core service health check is failing
    severity: critical
    condition:
      kind: service_down
      service: core
  - id: high-cpu
    summary: Host CPU usage is elevated
    condition:
      kind: system_above
      metric: cpu_percent
      threshold: 85
  - id: refresh-failed
    summary: Refresh failed
    severity: critical
    condition:
      kind: refresh_failed
`), 0o600); err != nil {
		t.Fatalf("write test alert rules: %v", err)
	}

	return config.Config{
		Port:                "9090",
		Version:             "0.1.0-test",
		HealthTimeout:       time.Second,
		RefreshInterval:     5 * time.Second,
		AlertRulesPath:      rulesPath,
		AlertWebhookTimeout: time.Second,
		AlertSource:         "atlas-metrics-test",
		DiskPath:            ".",
		Targets:             targets,
	}
}
