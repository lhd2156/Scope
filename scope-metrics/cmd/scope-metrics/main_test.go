package main

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	"scope-metrics/internal/config"
)

func TestStartServerBuildsConfiguredHTTPServer(t *testing.T) {
	cfg := config.Config{
		Port:            "9191",
		Version:         "test",
		HealthTimeout:   time.Second,
		RefreshInterval: time.Second,
		DiskPath:        ".",
		Targets:         []config.Target{{Name: "core", URL: "http://core.test/healthz"}},
	}
	called := false

	err := startServer(cfg, func(server *http.Server) error {
		called = true
		if server.Addr != ":9191" {
			t.Fatalf("expected configured address, got %q", server.Addr)
		}
		if server.Handler == nil {
			t.Fatal("expected handler to be configured")
		}
		if server.ReadHeaderTimeout != 5*time.Second {
			t.Fatalf("expected read header timeout, got %s", server.ReadHeaderTimeout)
		}
		return http.ErrServerClosed
	})

	if !called {
		t.Fatal("expected startServer to call listen function")
	}
	if !errors.Is(err, http.ErrServerClosed) {
		t.Fatalf("expected server closed error, got %v", err)
	}
}

func TestDefaultListenAndServeReturnsListenErrors(t *testing.T) {
	err := listenAndServe(&http.Server{Addr: "127.0.0.1:bad-port"})
	if err == nil {
		t.Fatal("expected invalid address to return a listen error")
	}
}

func TestExitOnErrorAllowsNilAndServerClosed(t *testing.T) {
	exitOnError(nil)
	exitOnError(http.ErrServerClosed)

	originalFatalf := logFatalf
	t.Cleanup(func() {
		logFatalf = originalFatalf
	})
	called := false
	logFatalf = func(format string, values ...any) {
		called = true
		if format == "" || len(values) != 1 {
			t.Fatalf("unexpected fatal call: %q %+v", format, values)
		}
	}

	exitOnError(fmt.Errorf("boom"))

	if !called {
		t.Fatal("expected non-server-closed errors to be fatal")
	}
}

func TestMainDelegatesToRunFunc(t *testing.T) {
	originalRun := runFunc
	originalFatalf := logFatalf
	t.Cleanup(func() {
		runFunc = originalRun
		logFatalf = originalFatalf
	})

	called := false
	runFunc = func() error {
		called = true
		return nil
	}
	logFatalf = func(format string, values ...any) {
		t.Fatalf("main should not fatal on nil run error")
	}

	main()

	if !called {
		t.Fatal("expected main to call runFunc")
	}
}

func TestRunInitializesSentryAndUsesLoadedConfig(t *testing.T) {
	t.Setenv("SENTRY_DSN", "https://public@example.com/1")
	t.Setenv("ENV", "test")
	t.Setenv("SCOPE_METRICS_PORT", "9292")
	t.Setenv("SCOPE_ALERT_RULES_FILE", "")

	originalListen := listenAndServe
	originalInit := sentryInit
	originalFlush := sentryFlush
	t.Cleanup(func() {
		listenAndServe = originalListen
		sentryInit = originalInit
		sentryFlush = originalFlush
	})

	var initialized sentry.ClientOptions
	flushed := false
	sentryInit = func(options sentry.ClientOptions) error {
		initialized = options
		return nil
	}
	sentryFlush = func(timeout time.Duration) bool {
		flushed = timeout == 2*time.Second
		return true
	}
	listenAndServe = func(server *http.Server) error {
		if server.Addr != ":9292" {
			t.Fatalf("expected port from environment, got %q", server.Addr)
		}
		return http.ErrServerClosed
	}

	err := run()

	if !errors.Is(err, http.ErrServerClosed) {
		t.Fatalf("expected server closed error, got %v", err)
	}
	if initialized.Dsn != "https://public@example.com/1" || initialized.Environment != "test" || initialized.TracesSampleRate != 0.1 {
		t.Fatalf("unexpected sentry options: %+v", initialized)
	}
	if !flushed {
		t.Fatal("expected successful sentry init to flush on exit")
	}
}

func TestRunContinuesWhenSentryInitializationFails(t *testing.T) {
	t.Setenv("SENTRY_DSN", "https://public@example.com/1")
	t.Setenv("SCOPE_METRICS_PORT", "9393")
	t.Setenv("SCOPE_ALERT_RULES_FILE", "")

	originalListen := listenAndServe
	originalInit := sentryInit
	originalFlush := sentryFlush
	t.Cleanup(func() {
		listenAndServe = originalListen
		sentryInit = originalInit
		sentryFlush = originalFlush
	})

	sentryInit = func(options sentry.ClientOptions) error {
		return fmt.Errorf("sentry down")
	}
	sentryFlush = func(timeout time.Duration) bool {
		t.Fatal("flush should not run when sentry init fails")
		return false
	}
	listenAndServe = func(server *http.Server) error {
		if server.Addr != ":9393" {
			t.Fatalf("expected port from environment, got %q", server.Addr)
		}
		return http.ErrServerClosed
	}

	if err := run(); !errors.Is(err, http.ErrServerClosed) {
		t.Fatalf("expected server closed error, got %v", err)
	}
}
