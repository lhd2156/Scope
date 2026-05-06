package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"time"

	"scope-metrics/internal/config"
	"scope-metrics/internal/server"
	"github.com/getsentry/sentry-go"
)

func main() {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn != "" {
		err := sentry.Init(sentry.ClientOptions{
			Dsn:              dsn,
			TracesSampleRate: 0.1,
			Environment:      os.Getenv("ENV"),
		})
		if err != nil {
			log.Printf("sentry initialization failed: %v", err)
		} else {
			defer sentry.Flush(2 * time.Second)
		}
	}

	cfg := config.Load()
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

	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("scope-metrics failed: %v", err)
	}
}
