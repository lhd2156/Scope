package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"atlas-metrics/internal/config"
)

func TestIndexRouteReturnsConfiguredTargets(t *testing.T) {
	t.Parallel()

	app := New(config.Config{
		Port:     "9090",
		Version:  "0.1.0-test",
		DiskPath: ".",
		Targets: []config.Target{
			{Name: "core", URL: "http://core:8080/api/core/health"},
			{Name: "content", URL: "http://content:8000/api/content/health"},
		},
	})

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
		"25.4",
		"http://core:8080/api/core/health",
		"http://content:8000/api/content/health",
		"lastRefreshSuccess",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected response body to contain %q, got %s", expected, body)
		}
	}
}

func TestHealthRouteReturnsOk(t *testing.T) {
	t.Parallel()

	app := New(config.Config{
		Port:     "9090",
		Version:  "0.1.0-test",
		DiskPath: ".",
	})

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

	app := New(config.Config{
		Port:     "9090",
		Version:  "0.1.0-test",
		DiskPath: ".",
	})

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

	app := New(config.Config{
		Port:     "9090",
		Version:  "0.1.0-test",
		DiskPath: ".",
		Targets: []config.Target{
			{Name: "intel", URL: targetServer.URL},
		},
	})

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
