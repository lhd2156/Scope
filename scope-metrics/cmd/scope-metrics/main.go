package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	"scope-metrics/internal/config"
	"scope-metrics/internal/server"
)

var (
	listenAndServe = func(httpServer *http.Server) error {
		return httpServer.ListenAndServe()
	}
	sentryInit  = sentry.Init
	sentryFlush = sentry.Flush
	logFatalf   = log.Fatalf
	runFunc     = run
)

func main() {
	exitOnError(runFunc())
}

func exitOnError(err error) {
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		logFatalf("scope-metrics failed: %v", err)
	}
}

func run() error {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn != "" {
		err := sentryInit(sentry.ClientOptions{
			Dsn:              dsn,
			TracesSampleRate: sentryTracesSampleRate(),
			Environment:      sentryEnvironment(),
			Release:          strings.TrimSpace(os.Getenv("SENTRY_RELEASE")),
		})
		if err != nil {
			log.Printf("sentry initialization failed: %v", err)
		} else {
			defer sentryFlush(2 * time.Second)
		}
	}

	cfg := config.Load()
	return startServer(cfg, listenAndServe)
}

func sentryEnvironment() string {
	if environment := strings.TrimSpace(os.Getenv("SENTRY_ENVIRONMENT")); environment != "" {
		return environment
	}
	return strings.TrimSpace(os.Getenv("ENV"))
}

func sentryTracesSampleRate() float64 {
	value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("SENTRY_TRACES_SAMPLE_RATE")), 64)
	if err != nil || value < 0 || value > 1 {
		return 0.1
	}
	return value
}

func startServer(cfg config.Config, listenAndServe func(*http.Server) error) error {
	app := server.New(cfg)

	httpServer := &http.Server{
		Addr:              cfg.ListenAddress(),
		Handler:           app.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf(
		"scope-metrics starting on %s with %d configured probe targets",
		cfg.ListenAddress(),
		len(cfg.Targets),
	)

	return listenAndServe(httpServer)
}
