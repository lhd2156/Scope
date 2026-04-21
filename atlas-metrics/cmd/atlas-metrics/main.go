package main

import (
	"errors"
	"log"
	"net/http"
	"time"

	"atlas-metrics/internal/config"
	"atlas-metrics/internal/server"
)

func main() {
	cfg := config.Load()
	app := server.New(cfg)

	httpServer := &http.Server{
		Addr:              cfg.ListenAddress(),
		Handler:           app.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf(
		"atlas-metrics starting on %s with %d configured probe targets",
		cfg.ListenAddress(),
		len(cfg.Targets),
	)

	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("atlas-metrics failed: %v", err)
	}
}
