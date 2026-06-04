package config

import (
	"testing"
	"time"
)

func TestLoadReadsEnvironmentAndDefaultsDurations(t *testing.T) {
	t.Setenv("SCOPE_METRICS_PORT", "9191")
	t.Setenv("SCOPE_METRICS_VERSION", "test-version")
	t.Setenv("SCOPE_HEALTH_TIMEOUT_SECONDS", "2.5")
	t.Setenv("SCOPE_REFRESH_INTERVAL_SECONDS", "-1")
	t.Setenv("SCOPE_ALERT_WEBHOOK_TIMEOUT_SECONDS", "not-a-number")
	t.Setenv("SCOPE_ALERT_RULES_FILE", "rules.yaml")
	t.Setenv("SCOPE_ALERT_WEBHOOK_URL", "https://hooks.example.test")
	t.Setenv("SCOPE_ALERT_WEBHOOK_BEARER_TOKEN", "token")
	t.Setenv("SCOPE_ALERT_SOURCE", "scope-test")
	t.Setenv("SCOPE_METRICS_DISK_PATH", "C:/")
	t.Setenv("SCOPE_CORE_HEALTH_URL", "http://core.test/healthz")
	t.Setenv("SCOPE_CONTENT_HEALTH_URL", "http://content.test/healthz")
	t.Setenv("SCOPE_INTEL_HEALTH_URL", "http://intel.test/healthz")

	cfg := Load()

	if cfg.Port != "9191" || cfg.ListenAddress() != ":9191" {
		t.Fatalf("expected configured listen address, got %#v", cfg.ListenAddress())
	}
	if cfg.Version != "test-version" {
		t.Fatalf("expected version from env, got %q", cfg.Version)
	}
	if cfg.HealthTimeout != 2500*time.Millisecond {
		t.Fatalf("expected fractional health timeout, got %s", cfg.HealthTimeout)
	}
	if cfg.RefreshInterval != 5*time.Second {
		t.Fatalf("expected invalid refresh interval to fall back, got %s", cfg.RefreshInterval)
	}
	if cfg.AlertWebhookTimeout != 5*time.Second {
		t.Fatalf("expected invalid webhook timeout to fall back, got %s", cfg.AlertWebhookTimeout)
	}
	if cfg.AlertRulesPath != "rules.yaml" || cfg.AlertWebhookURL == "" || cfg.AlertWebhookToken != "token" || cfg.AlertSource != "scope-test" {
		t.Fatalf("expected alert settings from env, got %+v", cfg)
	}
	if cfg.DiskPath != "C:/" {
		t.Fatalf("expected disk path from env, got %q", cfg.DiskPath)
	}
	if len(cfg.Targets) != 3 || cfg.Targets[0].URL != "http://core.test/healthz" || cfg.Targets[2].Name != "intel" {
		t.Fatalf("expected configured targets, got %+v", cfg.Targets)
	}
}

func TestLoadUsesFallbacksForEmptyEnvironmentValues(t *testing.T) {
	t.Setenv("SCOPE_METRICS_PORT", "")
	t.Setenv("SCOPE_HEALTH_TIMEOUT_SECONDS", "")

	cfg := Load()

	if cfg.Port != "9090" {
		t.Fatalf("expected default port, got %q", cfg.Port)
	}
	if cfg.HealthTimeout != 5*time.Second {
		t.Fatalf("expected default timeout, got %s", cfg.HealthTimeout)
	}
}
