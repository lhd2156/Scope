package alerts

import (
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestAlertLabelsCooldownAndDispatcherEdges(t *testing.T) {
	now := time.Date(2026, time.May, 21, 14, 30, 0, 0, time.UTC)
	rule := CompiledRule{
		ID:          "labeled",
		Summary:     "Labeled alert",
		Description: "keeps metadata",
		Severity:    "critical",
		Cooldown:    30 * time.Second,
		Labels:      map[string]string{"team": "platform", "service": "metrics"},
		Condition:   ConditionConfig{Kind: ConditionKindRefreshFailed},
	}

	alert := buildAlert(rule, "refresh failed without explicit errors", 42, now)
	if alert.Labels["team"] != "platform" || alert.Description != "keeps metadata" || alert.Value != 42 {
		t.Fatalf("expected buildAlert to preserve metadata, got %+v", alert)
	}
	rule.Labels["team"] = "mutated"
	if alert.Labels["team"] != "platform" {
		t.Fatalf("expected labels to be copied, got %+v", alert.Labels)
	}

	startedAt := now.Add(-time.Minute)
	endedAt := now
	webhookAlert := buildWebhookAlert(alert, "resolved", startedAt, endedAt)
	if webhookAlert.StartedAt == "" || webhookAlert.EndedAt == "" {
		t.Fatalf("expected webhook alert to include start and end times, got %+v", webhookAlert)
	}

	if parseCooldown("") != 0 {
		t.Fatal("expected blank cooldown to parse as zero")
	}

	dispatcher := NewDispatcher(DispatcherConfig{WebhookURL: "http://webhook.test"}, time.Second)
	sentAt := now.Add(2 * time.Minute)
	dispatcher.markSent([]WebhookAlert{
		{ID: "manual-start", Status: "firing", StartedAt: startedAt.Format(time.RFC3339)},
		{ID: "bad-start", Status: "firing", StartedAt: "not-rfc3339"},
		{ID: "resolved", Status: "resolved", StartedAt: startedAt.Format(time.RFC3339)},
	}, sentAt)

	if got := dispatcher.states["manual-start"]; got.StartedAt.IsZero() || !got.LastSentAt.Equal(sentAt) {
		t.Fatalf("expected markSent to parse missing start time and record send time, got %+v", got)
	}
	if dispatcher.states["resolved"].Active {
		t.Fatalf("expected resolved alert state to be inactive, got %+v", dispatcher.states["resolved"])
	}
}

func TestDispatcherReportsTransportFailures(t *testing.T) {
	dispatcher := NewDispatcher(DispatcherConfig{WebhookURL: "http://webhook.test", Source: "scope-metrics-test"}, time.Second)
	dispatcher.httpClient.Transport = roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return nil, errors.New("network down")
	})

	result := dispatcher.Process(t.Context(), []EvaluatedAlert{
		{
			ID:       "transport-failure",
			Summary:  "Transport failure",
			Severity: "warning",
			Observed: "send failed",
			Cooldown: "1m",
		},
	}, true)

	if !result.Attempted || result.Delivered || !strings.Contains(result.Error, "send webhook request") {
		t.Fatalf("expected transport failure to be reported, got %+v", result)
	}
}
