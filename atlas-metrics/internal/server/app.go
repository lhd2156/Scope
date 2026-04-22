package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"runtime"
	"sync"
	"time"

	"atlas-metrics/internal/alerts"
	"atlas-metrics/internal/config"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
)

type App struct {
	config         config.Config
	httpClient     *http.Client
	registry       *prometheus.Registry
	metricsHandler http.Handler
	startedAtUTC   time.Time
	metrics        metricsSet
	ruleSet        *alerts.RuleSet
	dispatcher     *alerts.Dispatcher
	rulesLoadError string

	refreshMu          sync.Mutex
	snapshot           refreshSnapshot
	snapshotCapturedAt time.Time
	activeAlerts       []alerts.EvaluatedAlert
	lastDispatch       alerts.DispatchResult
}

type featureFlags struct {
	SystemMetrics bool `json:"systemMetrics"`
	AppProbes     bool `json:"appProbes"`
	Alerting      bool `json:"alerting"`
}

type probeResult struct {
	Name           string  `json:"name"`
	URL            string  `json:"url"`
	Up             bool    `json:"up"`
	StatusCode     int     `json:"statusCode"`
	LatencySeconds float64 `json:"latencySeconds"`
	Error          string  `json:"error,omitempty"`
	LastCheckedUTC string  `json:"lastCheckedUtc"`
}

type systemSnapshot struct {
	CPUPercent        float64 `json:"cpuPercent"`
	MemoryUsedBytes   uint64  `json:"memoryUsedBytes"`
	MemoryTotalBytes  uint64  `json:"memoryTotalBytes"`
	MemoryUsedPercent float64 `json:"memoryUsedPercent"`
	DiskPath          string  `json:"diskPath"`
	DiskUsedBytes     uint64  `json:"diskUsedBytes"`
	DiskTotalBytes    uint64  `json:"diskTotalBytes"`
	DiskUsedPercent   float64 `json:"diskUsedPercent"`
}

type refreshSnapshot struct {
	LastRefreshSuccess  bool           `json:"lastRefreshSuccess"`
	LastRefreshedUTC    string         `json:"lastRefreshedUtc"`
	RefreshDurationSecs float64        `json:"refreshDurationSeconds"`
	System              systemSnapshot `json:"system"`
	Probes              []probeResult  `json:"probes"`
	Errors              []string       `json:"errors,omitempty"`
}

type indexResponse struct {
	Service        string           `json:"service"`
	Status         string           `json:"status"`
	Version        string           `json:"version"`
	Runtime        string           `json:"runtime"`
	StartedAtUTC   string           `json:"startedAtUtc"`
	HealthTimeout  string           `json:"healthTimeout"`
	Targets        []config.Target  `json:"targets"`
	CompletedPhase string           `json:"completedPhase"`
	NextPhase      string           `json:"nextPhase"`
	Features       featureFlags     `json:"features"`
	Refresh        refreshSnapshot  `json:"refresh"`
	Alerting       alertingResponse `json:"alerting"`
}

type healthResponse struct {
	Status         string           `json:"status"`
	Service        string           `json:"service"`
	Version        string           `json:"version"`
	CompletedPhase string           `json:"completedPhase"`
	NextPhase      string           `json:"nextPhase"`
	Refresh        refreshSnapshot  `json:"refresh"`
	Alerting       alertingResponse `json:"alerting"`
}

type alertingResponse struct {
	RulesPath      string                  `json:"rulesPath"`
	RulesVersion   int                     `json:"rulesVersion"`
	RulesLoaded    bool                    `json:"rulesLoaded"`
	RuleCount      int                     `json:"ruleCount"`
	WebhookEnabled bool                    `json:"webhookEnabled"`
	WebhookURL     string                  `json:"webhookUrl,omitempty"`
	LoadError      string                  `json:"loadError,omitempty"`
	ActiveAlerts   []alerts.EvaluatedAlert `json:"activeAlerts"`
	LastDispatch   alerts.DispatchResult   `json:"lastDispatch"`
}

type metricsSet struct {
	buildInfo           *prometheus.GaugeVec
	startTime           prometheus.Gauge
	serviceUp           *prometheus.GaugeVec
	serviceResponseSecs *prometheus.GaugeVec
	serviceStatusCode   *prometheus.GaugeVec
	lastRefreshSuccess  prometheus.Gauge
	lastRefreshTime     prometheus.Gauge
	lastRefreshDuration prometheus.Gauge
	systemCPUPercent    prometheus.Gauge
	systemMemoryUsed    prometheus.Gauge
	systemMemoryTotal   prometheus.Gauge
	systemMemoryPercent prometheus.Gauge
	systemDiskUsed      *prometheus.GaugeVec
	systemDiskTotal     *prometheus.GaugeVec
	systemDiskPercent   *prometheus.GaugeVec
	refreshTotal        *prometheus.CounterVec
	httpRequestsTotal   *prometheus.CounterVec
	alertRulesLoaded    prometheus.Gauge
	alertRuleActive     *prometheus.GaugeVec
	alertDispatchTotal  *prometheus.CounterVec
	alertDispatchStatus *prometheus.GaugeVec
}

func New(cfg config.Config) *App {
	registry := prometheus.NewRegistry()
	ruleSet, rulesLoadError := alerts.LoadRuleSet(cfg.AlertRulesPath)

	metrics := metricsSet{
		buildInfo: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "atlas_metrics_build_info",
				Help: "Static build metadata for the Atlas metrics service.",
			},
			[]string{"version", "runtime"},
		),
		startTime: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "atlas_metrics_start_time_seconds",
				Help: "Unix start time for the Atlas metrics service.",
			},
		),
		serviceUp: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "atlas_service_up",
				Help: "Whether an Atlas dependency health check responded successfully.",
			},
			[]string{"service", "url"},
		),
		serviceResponseSecs: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "atlas_service_response_seconds",
				Help: "Response latency for Atlas dependency health checks.",
			},
			[]string{"service", "url"},
		),
		serviceStatusCode: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "atlas_service_status_code",
				Help: "Latest HTTP status code observed for an Atlas dependency health check.",
			},
			[]string{"service", "url"},
		),
		lastRefreshSuccess: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "atlas_metrics_last_refresh_success",
				Help: "Whether the most recent dependency and system-metric refresh completed successfully.",
			},
		),
		lastRefreshTime: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "atlas_metrics_last_refresh_timestamp_seconds",
				Help: "Unix timestamp of the most recent atlas-metrics refresh.",
			},
		),
		lastRefreshDuration: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "atlas_metrics_last_refresh_duration_seconds",
				Help: "Duration of the most recent atlas-metrics refresh.",
			},
		),
		systemCPUPercent: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "atlas_system_cpu_percent",
				Help: "Host CPU utilization percentage observed by atlas-metrics.",
			},
		),
		systemMemoryUsed: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "atlas_system_memory_used_bytes",
				Help: "Host memory currently in use.",
			},
		),
		systemMemoryTotal: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "atlas_system_memory_total_bytes",
				Help: "Host memory available to the system.",
			},
		),
		systemMemoryPercent: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "atlas_system_memory_used_percent",
				Help: "Host memory utilization percentage.",
			},
		),
		systemDiskUsed: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "atlas_system_disk_used_bytes",
				Help: "Disk usage for the configured atlas-metrics disk path.",
			},
			[]string{"path"},
		),
		systemDiskTotal: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "atlas_system_disk_total_bytes",
				Help: "Total disk capacity for the configured atlas-metrics disk path.",
			},
			[]string{"path"},
		),
		systemDiskPercent: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "atlas_system_disk_used_percent",
				Help: "Disk utilization percentage for the configured atlas-metrics disk path.",
			},
			[]string{"path"},
		),
		refreshTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "atlas_metrics_refresh_total",
				Help: "Total number of atlas-metrics refresh attempts by result.",
			},
			[]string{"result"},
		),
		httpRequestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "atlas_metrics_http_requests_total",
				Help: "Total number of atlas-metrics HTTP requests by route and method.",
			},
			[]string{"route", "method"},
		),
		alertRulesLoaded: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "atlas_alert_rules_loaded",
				Help: "Whether atlas-metrics loaded its alert-rule configuration successfully.",
			},
		),
		alertRuleActive: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "atlas_alert_rule_active",
				Help: "Whether an atlas alert rule is currently firing.",
			},
			[]string{"rule_id", "severity"},
		),
		alertDispatchTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "atlas_alert_dispatch_total",
				Help: "Total number of webhook dispatch attempts by result.",
			},
			[]string{"result"},
		),
		alertDispatchStatus: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "atlas_alert_dispatch_status",
				Help: "Latest webhook dispatch outcome for atlas-metrics.",
			},
			[]string{"webhook"},
		),
	}

	registry.MustRegister(
		metrics.buildInfo,
		metrics.startTime,
		metrics.serviceUp,
		metrics.serviceResponseSecs,
		metrics.serviceStatusCode,
		metrics.lastRefreshSuccess,
		metrics.lastRefreshTime,
		metrics.lastRefreshDuration,
		metrics.systemCPUPercent,
		metrics.systemMemoryUsed,
		metrics.systemMemoryTotal,
		metrics.systemMemoryPercent,
		metrics.systemDiskUsed,
		metrics.systemDiskTotal,
		metrics.systemDiskPercent,
		metrics.refreshTotal,
		metrics.httpRequestsTotal,
		metrics.alertRulesLoaded,
		metrics.alertRuleActive,
		metrics.alertDispatchTotal,
		metrics.alertDispatchStatus,
	)
	metrics.buildInfo.WithLabelValues(cfg.Version, runtime.Version()).Set(1)
	metrics.alertDispatchTotal.WithLabelValues("success")
	metrics.alertDispatchTotal.WithLabelValues("failure")
	if rulesLoadError == nil {
		metrics.alertRulesLoaded.Set(1)
	} else {
		metrics.alertRulesLoaded.Set(0)
	}

	startedAtUTC := time.Now().UTC()
	metrics.startTime.Set(float64(startedAtUTC.Unix()))

	dispatcher := alerts.NewDispatcher(
		alerts.DispatcherConfig{
			WebhookURL:  cfg.AlertWebhookURL,
			BearerToken: cfg.AlertWebhookToken,
			Source:      cfg.AlertSource,
		},
		cfg.AlertWebhookTimeout,
	)

	loadError := ""
	if rulesLoadError != nil {
		loadError = rulesLoadError.Error()
	}

	app := &App{
		config:         cfg,
		httpClient:     &http.Client{Timeout: cfg.HealthTimeout},
		registry:       registry,
		metricsHandler: promhttp.HandlerFor(registry, promhttp.HandlerOpts{}),
		startedAtUTC:   startedAtUTC,
		metrics:        metrics,
		ruleSet:        ruleSet,
		dispatcher:     dispatcher,
		rulesLoadError: loadError,
	}

	return app
}

func (a *App) Handler() http.Handler {
	router := mux.NewRouter()
	router.Handle("/", a.instrument("index", http.HandlerFunc(a.handleIndex))).Methods(http.MethodGet)
	router.Handle("/healthz", a.instrument("healthz", http.HandlerFunc(a.handleHealth))).Methods(http.MethodGet)
	router.Handle("/metrics", a.instrument("metrics", http.HandlerFunc(a.handleMetrics))).Methods(http.MethodGet)
	router.Handle("/alerts/rules", a.instrument("alerts_rules", http.HandlerFunc(a.handleAlertRules))).Methods(http.MethodGet)
	router.Handle("/alerts/active", a.instrument("alerts_active", http.HandlerFunc(a.handleActiveAlerts))).Methods(http.MethodGet)
	router.Handle("/alerts/dispatch", a.instrument("alerts_dispatch", http.HandlerFunc(a.handleDispatchAlerts))).Methods(http.MethodPost)
	return router
}

func (a *App) handleIndex(writer http.ResponseWriter, request *http.Request) {
	snapshot := a.refresh(request.Context())

	writeJSON(writer, http.StatusOK, indexResponse{
		Service:        "atlas-metrics",
		Status:         "ok",
		Version:        a.config.Version,
		Runtime:        runtime.Version(),
		StartedAtUTC:   a.startedAtUTC.Format(time.RFC3339),
		HealthTimeout:  a.config.HealthTimeout.String(),
		Targets:        a.config.Targets,
		CompletedPhase: "25.5",
		NextPhase:      "Phase 25 complete - ready for the next platform milestone",
		Features: featureFlags{
			SystemMetrics: true,
			AppProbes:     true,
			Alerting:      true,
		},
		Refresh:  snapshot,
		Alerting: a.buildAlertingResponse(),
	})
}

func (a *App) handleHealth(writer http.ResponseWriter, request *http.Request) {
	snapshot := a.refresh(request.Context())

	writeJSON(writer, http.StatusOK, healthResponse{
		Status:         "ok",
		Service:        "atlas-metrics",
		Version:        a.config.Version,
		CompletedPhase: "25.5",
		NextPhase:      "Phase 25 complete - ready for the next platform milestone",
		Refresh:        snapshot,
		Alerting:       a.buildAlertingResponse(),
	})
}

func (a *App) handleMetrics(writer http.ResponseWriter, request *http.Request) {
	a.refresh(request.Context())
	a.metricsHandler.ServeHTTP(writer, request)
}

func (a *App) handleAlertRules(writer http.ResponseWriter, _ *http.Request) {
	var ruleConfig any
	if a.ruleSet != nil {
		ruleConfig = a.ruleSet.Config
	}

	writeJSON(writer, http.StatusOK, map[string]any{
		"rulesPath":   a.config.AlertRulesPath,
		"rulesLoaded": a.ruleSet != nil && a.rulesLoadError == "",
		"loadError":   a.rulesLoadError,
		"config":      ruleConfig,
	})
}

func (a *App) handleActiveAlerts(writer http.ResponseWriter, request *http.Request) {
	a.refresh(request.Context())
	writeJSON(writer, http.StatusOK, a.buildAlertingResponse())
}

func (a *App) handleDispatchAlerts(writer http.ResponseWriter, request *http.Request) {
	snapshot := a.refreshWithoutDispatch(request.Context())
	activeAlerts := a.copyActiveAlerts()
	dispatchResult := a.dispatcher.Process(request.Context(), activeAlerts, true)
	a.recordDispatchMetrics(dispatchResult)
	a.setLastDispatch(dispatchResult)

	writeJSON(writer, http.StatusOK, map[string]any{
		"refresh":      snapshot,
		"activeAlerts": activeAlerts,
		"dispatch":     dispatchResult,
	})
}

func (a *App) refresh(ctx context.Context) refreshSnapshot {
	return a.refreshWithDispatch(ctx, true)
}

func (a *App) refreshWithoutDispatch(ctx context.Context) refreshSnapshot {
	return a.refreshWithDispatch(ctx, false)
}

func (a *App) refreshWithDispatch(ctx context.Context, dispatch bool) refreshSnapshot {
	a.refreshMu.Lock()
	defer a.refreshMu.Unlock()

	if a.shouldReuseSnapshot(time.Now().UTC()) {
		return cloneRefreshSnapshot(a.snapshot)
	}

	startedAt := time.Now()
	snapshot := refreshSnapshot{
		Probes: make([]probeResult, 0, len(a.config.Targets)),
		System: systemSnapshot{
			DiskPath: a.config.DiskPath,
		},
	}
	refreshSucceeded := true

	cpuPercent, err := cpu.PercentWithContext(ctx, 0, false)
	if err != nil {
		snapshot.Errors = append(snapshot.Errors, "cpu: "+err.Error())
		refreshSucceeded = false
	} else if len(cpuPercent) > 0 {
		snapshot.System.CPUPercent = cpuPercent[0]
		a.metrics.systemCPUPercent.Set(cpuPercent[0])
	}

	virtualMemory, err := mem.VirtualMemoryWithContext(ctx)
	if err != nil {
		snapshot.Errors = append(snapshot.Errors, "memory: "+err.Error())
		refreshSucceeded = false
	} else {
		snapshot.System.MemoryUsedBytes = virtualMemory.Used
		snapshot.System.MemoryTotalBytes = virtualMemory.Total
		snapshot.System.MemoryUsedPercent = virtualMemory.UsedPercent
		a.metrics.systemMemoryUsed.Set(float64(virtualMemory.Used))
		a.metrics.systemMemoryTotal.Set(float64(virtualMemory.Total))
		a.metrics.systemMemoryPercent.Set(virtualMemory.UsedPercent)
	}

	diskUsage, err := disk.UsageWithContext(ctx, a.config.DiskPath)
	if err != nil {
		snapshot.Errors = append(snapshot.Errors, "disk: "+err.Error())
		refreshSucceeded = false
	} else {
		snapshot.System.DiskUsedBytes = diskUsage.Used
		snapshot.System.DiskTotalBytes = diskUsage.Total
		snapshot.System.DiskUsedPercent = diskUsage.UsedPercent
		a.metrics.systemDiskUsed.WithLabelValues(a.config.DiskPath).Set(float64(diskUsage.Used))
		a.metrics.systemDiskTotal.WithLabelValues(a.config.DiskPath).Set(float64(diskUsage.Total))
		a.metrics.systemDiskPercent.WithLabelValues(a.config.DiskPath).Set(diskUsage.UsedPercent)
	}

	for _, result := range a.probeTargets(ctx) {
		snapshot.Probes = append(snapshot.Probes, result)
		if !result.Up {
			refreshSucceeded = false
		}
	}

	completedAt := time.Now().UTC()
	snapshot.LastRefreshSuccess = refreshSucceeded
	snapshot.LastRefreshedUTC = completedAt.Format(time.RFC3339)
	snapshot.RefreshDurationSecs = time.Since(startedAt).Seconds()

	if refreshSucceeded {
		a.metrics.refreshTotal.WithLabelValues("success").Inc()
		a.metrics.lastRefreshSuccess.Set(1)
	} else {
		a.metrics.refreshTotal.WithLabelValues("failure").Inc()
		a.metrics.lastRefreshSuccess.Set(0)
	}
	a.metrics.lastRefreshTime.Set(float64(completedAt.Unix()))
	a.metrics.lastRefreshDuration.Set(snapshot.RefreshDurationSecs)

	a.snapshot = snapshot
	a.snapshotCapturedAt = completedAt
	a.evaluateAlerts(snapshot, dispatch)
	return cloneRefreshSnapshot(snapshot)
}

func (a *App) shouldReuseSnapshot(now time.Time) bool {
	if a.snapshotCapturedAt.IsZero() {
		return false
	}

	return now.Sub(a.snapshotCapturedAt) < a.config.RefreshInterval
}

func (a *App) probeTargets(ctx context.Context) []probeResult {
	results := make([]probeResult, len(a.config.Targets))
	var waitGroup sync.WaitGroup

	for index, target := range a.config.Targets {
		waitGroup.Add(1)

		go func(index int, target config.Target) {
			defer waitGroup.Done()
			results[index] = a.probeTarget(ctx, target)
		}(index, target)
	}

	waitGroup.Wait()
	return results
}

func (a *App) probeTarget(ctx context.Context, target config.Target) probeResult {
	startedAt := time.Now()
	result := probeResult{
		Name: target.Name,
		URL:  target.URL,
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.URL, nil)
	if err != nil {
		result.Error = err.Error()
		result.LastCheckedUTC = time.Now().UTC().Format(time.RFC3339)
		a.metrics.serviceUp.WithLabelValues(target.Name, target.URL).Set(0)
		a.metrics.serviceResponseSecs.WithLabelValues(target.Name, target.URL).Set(0)
		a.metrics.serviceStatusCode.WithLabelValues(target.Name, target.URL).Set(0)
		return result
	}

	response, err := a.httpClient.Do(request)
	if err != nil {
		result.Error = err.Error()
		result.LastCheckedUTC = time.Now().UTC().Format(time.RFC3339)
		a.metrics.serviceUp.WithLabelValues(target.Name, target.URL).Set(0)
		a.metrics.serviceResponseSecs.WithLabelValues(target.Name, target.URL).Set(0)
		a.metrics.serviceStatusCode.WithLabelValues(target.Name, target.URL).Set(0)
		return result
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)

	result.StatusCode = response.StatusCode
	result.LatencySeconds = time.Since(startedAt).Seconds()
	result.Up = response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices
	result.LastCheckedUTC = time.Now().UTC().Format(time.RFC3339)

	a.metrics.serviceResponseSecs.WithLabelValues(target.Name, target.URL).Set(result.LatencySeconds)
	a.metrics.serviceStatusCode.WithLabelValues(target.Name, target.URL).Set(float64(response.StatusCode))
	if result.Up {
		a.metrics.serviceUp.WithLabelValues(target.Name, target.URL).Set(1)
	} else {
		a.metrics.serviceUp.WithLabelValues(target.Name, target.URL).Set(0)
	}

	return result
}

func (a *App) instrument(route string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		a.metrics.httpRequestsTotal.WithLabelValues(route, request.Method).Inc()
		next.ServeHTTP(writer, request)
	})
}

func (a *App) evaluateAlerts(snapshot refreshSnapshot, dispatch bool) {
	if a.ruleSet == nil {
		a.activeAlerts = nil
		return
	}

	evaluatedAlerts := a.ruleSet.Evaluate(alerts.Snapshot{
		LastRefreshSuccess: snapshot.LastRefreshSuccess,
		LastRefreshedUTC:   snapshot.LastRefreshedUTC,
		System: alerts.SystemSnapshot{
			CPUPercent:        snapshot.System.CPUPercent,
			MemoryUsedBytes:   snapshot.System.MemoryUsedBytes,
			MemoryTotalBytes:  snapshot.System.MemoryTotalBytes,
			MemoryUsedPercent: snapshot.System.MemoryUsedPercent,
			DiskPath:          snapshot.System.DiskPath,
			DiskUsedBytes:     snapshot.System.DiskUsedBytes,
			DiskTotalBytes:    snapshot.System.DiskTotalBytes,
			DiskUsedPercent:   snapshot.System.DiskUsedPercent,
		},
		Probes: convertProbes(snapshot.Probes),
		Errors: snapshot.Errors,
	}, time.Now().UTC())

	for _, rule := range a.ruleSet.Rules {
		a.metrics.alertRuleActive.WithLabelValues(rule.ID, rule.Severity).Set(0)
	}

	for _, activeAlert := range evaluatedAlerts {
		a.metrics.alertRuleActive.WithLabelValues(activeAlert.ID, activeAlert.Severity).Set(1)
	}

	a.activeAlerts = evaluatedAlerts
	if !dispatch {
		return
	}

	dispatchResult := a.dispatcher.Process(context.Background(), evaluatedAlerts, false)
	a.recordDispatchMetrics(dispatchResult)
	a.lastDispatch = dispatchResult
}

func (a *App) recordDispatchMetrics(dispatchResult alerts.DispatchResult) {
	webhook := dispatchResult.WebhookURL
	if webhook == "" {
		webhook = "disabled"
	}

	if !dispatchResult.Attempted {
		a.metrics.alertDispatchStatus.WithLabelValues(webhook).Set(0)
		return
	}

	if dispatchResult.Delivered {
		a.metrics.alertDispatchTotal.WithLabelValues("success").Inc()
		a.metrics.alertDispatchStatus.WithLabelValues(webhook).Set(1)
		return
	}

	a.metrics.alertDispatchTotal.WithLabelValues("failure").Inc()
	a.metrics.alertDispatchStatus.WithLabelValues(webhook).Set(0)
}

func (a *App) buildAlertingResponse() alertingResponse {
	rulesVersion := 0
	ruleCount := 0
	activeAlerts := a.copyActiveAlerts()
	lastDispatch := a.copyLastDispatch()
	if a.ruleSet != nil {
		rulesVersion = a.ruleSet.Config.Version
		ruleCount = len(a.ruleSet.Rules)
	}

	return alertingResponse{
		RulesPath:      a.config.AlertRulesPath,
		RulesVersion:   rulesVersion,
		RulesLoaded:    a.ruleSet != nil && a.rulesLoadError == "",
		RuleCount:      ruleCount,
		WebhookEnabled: a.dispatcher.Enabled(),
		WebhookURL:     a.config.AlertWebhookURL,
		LoadError:      a.rulesLoadError,
		ActiveAlerts:   activeAlerts,
		LastDispatch:   lastDispatch,
	}
}

func convertProbes(probes []probeResult) []alerts.ProbeSnapshot {
	converted := make([]alerts.ProbeSnapshot, 0, len(probes))
	for _, probe := range probes {
		converted = append(converted, alerts.ProbeSnapshot{
			Name:           probe.Name,
			URL:            probe.URL,
			Up:             probe.Up,
			StatusCode:     probe.StatusCode,
			LatencySeconds: probe.LatencySeconds,
			Error:          probe.Error,
			LastCheckedUTC: probe.LastCheckedUTC,
		})
	}

	return converted
}

func cloneRefreshSnapshot(snapshot refreshSnapshot) refreshSnapshot {
	cloned := snapshot
	cloned.Probes = append([]probeResult(nil), snapshot.Probes...)
	cloned.Errors = append([]string(nil), snapshot.Errors...)
	return cloned
}

func (a *App) copyActiveAlerts() []alerts.EvaluatedAlert {
	a.refreshMu.Lock()
	defer a.refreshMu.Unlock()

	return append([]alerts.EvaluatedAlert(nil), a.activeAlerts...)
}

func (a *App) copyLastDispatch() alerts.DispatchResult {
	a.refreshMu.Lock()
	defer a.refreshMu.Unlock()

	dispatchResult := a.lastDispatch
	dispatchResult.Alerts = append([]alerts.WebhookAlert(nil), a.lastDispatch.Alerts...)
	return dispatchResult
}

func (a *App) setLastDispatch(dispatchResult alerts.DispatchResult) {
	a.refreshMu.Lock()
	defer a.refreshMu.Unlock()

	a.lastDispatch = dispatchResult
}

func writeJSON(writer http.ResponseWriter, statusCode int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(statusCode)

	encoder := json.NewEncoder(writer)
	encoder.SetIndent("", "  ")
	_ = encoder.Encode(payload)
}
