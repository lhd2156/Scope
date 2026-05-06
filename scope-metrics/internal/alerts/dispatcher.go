package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

type DispatcherConfig struct {
	WebhookURL  string
	BearerToken string
	Source      string
}

type Dispatcher struct {
	config     DispatcherConfig
	httpClient *http.Client

	mu     sync.Mutex
	states map[string]dispatchState
}

type dispatchState struct {
	Active     bool
	StartedAt  time.Time
	LastSentAt time.Time
}

type WebhookPayload struct {
	Source         string         `json:"source"`
	GeneratedAtUTC string         `json:"generatedAtUtc"`
	Alerts         []WebhookAlert `json:"alerts"`
}

type WebhookAlert struct {
	ID          string            `json:"id"`
	Status      string            `json:"status"`
	Severity    string            `json:"severity"`
	Summary     string            `json:"summary"`
	Description string            `json:"description,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	Observed    string            `json:"observed"`
	Value       float64           `json:"value,omitempty"`
	StartedAt   string            `json:"startedAtUtc,omitempty"`
	EndedAt     string            `json:"endedAtUtc,omitempty"`
}

type DispatchResult struct {
	Enabled        bool           `json:"enabled"`
	WebhookURL     string         `json:"webhookUrl,omitempty"`
	Attempted      bool           `json:"attempted"`
	Delivered      bool           `json:"delivered"`
	Alerts         []WebhookAlert `json:"alerts,omitempty"`
	Error          string         `json:"error,omitempty"`
	GeneratedAtUTC string         `json:"generatedAtUtc"`
}

func NewDispatcher(config DispatcherConfig, timeout time.Duration) *Dispatcher {
	return &Dispatcher{
		config: config,
		httpClient: &http.Client{
			Timeout: timeout,
		},
		states: map[string]dispatchState{},
	}
}

func (d *Dispatcher) Enabled() bool {
	return d.config.WebhookURL != ""
}

func (d *Dispatcher) Process(ctx context.Context, evaluatedAlerts []EvaluatedAlert, force bool) DispatchResult {
	now := time.Now().UTC()
	result := DispatchResult{
		Enabled:        d.Enabled(),
		WebhookURL:     d.config.WebhookURL,
		GeneratedAtUTC: now.Format(time.RFC3339),
	}

	firingAlerts, resolvedAlerts := d.buildTransitions(evaluatedAlerts, now, force)
	payloadAlerts := append(firingAlerts, resolvedAlerts...)
	result.Alerts = payloadAlerts

	if !d.Enabled() || len(payloadAlerts) == 0 {
		return result
	}
	result.Attempted = true

	payload := WebhookPayload{
		Source:         d.config.Source,
		GeneratedAtUTC: result.GeneratedAtUTC,
		Alerts:         payloadAlerts,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		result.Error = fmt.Sprintf("marshal webhook payload: %v", err)
		return result
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, d.config.WebhookURL, bytes.NewReader(body))
	if err != nil {
		result.Error = fmt.Sprintf("build webhook request: %v", err)
		return result
	}

	request.Header.Set("Content-Type", "application/json")
	if d.config.BearerToken != "" {
		request.Header.Set("Authorization", "Bearer "+d.config.BearerToken)
	}

	response, err := d.httpClient.Do(request)
	if err != nil {
		result.Error = fmt.Sprintf("send webhook request: %v", err)
		return result
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		result.Error = fmt.Sprintf("webhook returned status %d", response.StatusCode)
		return result
	}

	result.Delivered = true
	d.markSent(payloadAlerts, now)
	return result
}

func (d *Dispatcher) buildTransitions(evaluatedAlerts []EvaluatedAlert, now time.Time, force bool) ([]WebhookAlert, []WebhookAlert) {
	d.mu.Lock()
	defer d.mu.Unlock()

	activeByID := make(map[string]EvaluatedAlert, len(evaluatedAlerts))
	firingAlerts := make([]WebhookAlert, 0, len(evaluatedAlerts))

	for _, alert := range evaluatedAlerts {
		activeByID[alert.ID] = alert
		state := d.states[alert.ID]

		if !state.Active {
			state.Active = true
			state.StartedAt = now
			d.states[alert.ID] = state
			firingAlerts = append(firingAlerts, buildWebhookAlert(alert, "firing", state.StartedAt, time.Time{}))
			continue
		}

		cooldown := parseCooldown(alert.Cooldown)
		if force || cooldown == 0 || now.Sub(state.LastSentAt) >= cooldown {
			firingAlerts = append(firingAlerts, buildWebhookAlert(alert, "firing", state.StartedAt, time.Time{}))
		}
	}

	resolvedAlerts := make([]WebhookAlert, 0)
	for alertID, state := range d.states {
		if !state.Active {
			continue
		}

		if _, stillActive := activeByID[alertID]; stillActive {
			continue
		}

		state.Active = false
		d.states[alertID] = state
		resolvedAlerts = append(resolvedAlerts, WebhookAlert{
			ID:        alertID,
			Status:    "resolved",
			StartedAt: state.StartedAt.Format(time.RFC3339),
			EndedAt:   now.Format(time.RFC3339),
		})
	}

	return firingAlerts, resolvedAlerts
}

func (d *Dispatcher) markSent(alerts []WebhookAlert, sentAt time.Time) {
	d.mu.Lock()
	defer d.mu.Unlock()

	for _, alert := range alerts {
		state := d.states[alert.ID]
		state.LastSentAt = sentAt
		if state.StartedAt.IsZero() && alert.StartedAt != "" {
			parsedStart, err := time.Parse(time.RFC3339, alert.StartedAt)
			if err == nil {
				state.StartedAt = parsedStart
			}
		}
		if alert.Status == "resolved" {
			state.Active = false
		}
		d.states[alert.ID] = state
	}
}

func buildWebhookAlert(alert EvaluatedAlert, status string, startedAt time.Time, endedAt time.Time) WebhookAlert {
	webhookAlert := WebhookAlert{
		ID:          alert.ID,
		Status:      status,
		Severity:    alert.Severity,
		Summary:     alert.Summary,
		Description: alert.Description,
		Labels:      alert.Labels,
		Observed:    alert.Observed,
		Value:       alert.Value,
	}

	if !startedAt.IsZero() {
		webhookAlert.StartedAt = startedAt.Format(time.RFC3339)
	}

	if !endedAt.IsZero() {
		webhookAlert.EndedAt = endedAt.Format(time.RFC3339)
	}

	return webhookAlert
}

func parseCooldown(rawCooldown string) time.Duration {
	if rawCooldown == "" {
		return 0
	}

	duration, err := time.ParseDuration(rawCooldown)
	if err != nil {
		return 0
	}

	return duration
}
