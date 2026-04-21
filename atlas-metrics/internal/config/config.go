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
	AlertRulesPath      string
	AlertWebhookURL     string
	AlertWebhookToken   string
	AlertWebhookTimeout time.Duration
	AlertSource         string
	DiskPath            string
	Targets             []Target
}

func Load() Config {
	timeoutSeconds, err := strconv.ParseFloat(getEnv("ATLAS_HEALTH_TIMEOUT_SECONDS", "5"), 64)
	if err != nil || timeoutSeconds <= 0 {
		timeoutSeconds = 5
	}

	webhookTimeoutSeconds, err := strconv.ParseFloat(getEnv("ATLAS_ALERT_WEBHOOK_TIMEOUT_SECONDS", "5"), 64)
	if err != nil || webhookTimeoutSeconds <= 0 {
		webhookTimeoutSeconds = 5
	}

	return Config{
		Port:                getEnv("ATLAS_METRICS_PORT", "9090"),
		Version:             getEnv("ATLAS_METRICS_VERSION", "0.1.0"),
		HealthTimeout:       time.Duration(timeoutSeconds * float64(time.Second)),
		AlertRulesPath:      getEnv("ATLAS_ALERT_RULES_FILE", "config/alert-rules.yaml"),
		AlertWebhookURL:     getEnv("ATLAS_ALERT_WEBHOOK_URL", ""),
		AlertWebhookToken:   getEnv("ATLAS_ALERT_WEBHOOK_BEARER_TOKEN", ""),
		AlertWebhookTimeout: time.Duration(webhookTimeoutSeconds * float64(time.Second)),
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
