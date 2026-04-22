package config

import (
	"os"
	"strconv"
	"time"
)

type Target struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type Config struct {
	Port                string
	Version             string
	HealthTimeout       time.Duration
	RefreshInterval     time.Duration
	AlertRulesPath      string
	AlertWebhookURL     string
	AlertWebhookToken   string
	AlertWebhookTimeout time.Duration
	AlertSource         string
	DiskPath            string
	Targets             []Target
}

func Load() Config {
	return Config{
		Port:                getEnv("ATLAS_METRICS_PORT", "9090"),
		Version:             getEnv("ATLAS_METRICS_VERSION", "0.1.0"),
		HealthTimeout:       loadPositiveDuration("ATLAS_HEALTH_TIMEOUT_SECONDS", 5),
		RefreshInterval:     loadPositiveDuration("ATLAS_REFRESH_INTERVAL_SECONDS", 5),
		AlertRulesPath:      getEnv("ATLAS_ALERT_RULES_FILE", "config/alert-rules.yaml"),
		AlertWebhookURL:     getEnv("ATLAS_ALERT_WEBHOOK_URL", ""),
		AlertWebhookToken:   getEnv("ATLAS_ALERT_WEBHOOK_BEARER_TOKEN", ""),
		AlertWebhookTimeout: loadPositiveDuration("ATLAS_ALERT_WEBHOOK_TIMEOUT_SECONDS", 5),
		AlertSource:         getEnv("ATLAS_ALERT_SOURCE", "atlas-metrics"),
		DiskPath:            getEnv("ATLAS_METRICS_DISK_PATH", "."),
		Targets: []Target{
			{
				Name: "core",
				URL:  getEnv("ATLAS_CORE_HEALTH_URL", "http://localhost:5001/api/core/health"),
			},
			{
				Name: "content",
				URL:  getEnv("ATLAS_CONTENT_HEALTH_URL", "http://localhost:5002/api/content/health"),
			},
			{
				Name: "intel",
				URL:  getEnv("ATLAS_INTEL_HEALTH_URL", "http://localhost:5003/api/intel/health"),
			},
		},
	}
}

func (c Config) ListenAddress() string {
	return ":" + c.Port
}

func getEnv(key string, fallback string) string {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}

	return value
}

func loadPositiveDuration(key string, fallbackSeconds float64) time.Duration {
	seconds, err := strconv.ParseFloat(getEnv(key, strconv.FormatFloat(fallbackSeconds, 'f', -1, 64)), 64)
	if err != nil || seconds <= 0 {
		seconds = fallbackSeconds
	}

	return time.Duration(seconds * float64(time.Second))
}
