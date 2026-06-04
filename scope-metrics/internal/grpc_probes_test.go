package internal

import (
	"net"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

func TestProbeGRPCReportsServingHealthStatus(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	server := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("scope.core", healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(server, healthServer)
	go func() {
		_ = server.Serve(listener)
	}()
	defer server.Stop()

	result := ProbeGRPC(listener.Addr().String(), "scope.core", time.Second)

	if result.Status != "SERVING" {
		t.Fatalf("expected SERVING, got %+v", result)
	}
	if result.Service != "scope.core" || result.Address != listener.Addr().String() || result.Latency == "" || result.Error != "" {
		t.Fatalf("unexpected probe result: %+v", result)
	}
}

func TestProbeGRPCReportsCheckErrorsAndUnreachableEndpoints(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	server := grpc.NewServer()
	healthpb.RegisterHealthServer(server, health.NewServer())
	go func() {
		_ = server.Serve(listener)
	}()
	defer server.Stop()

	checkError := ProbeGRPC(listener.Addr().String(), "missing", time.Second)
	if checkError.Status != "ERROR" || checkError.Error == "" {
		t.Fatalf("expected health check error, got %+v", checkError)
	}

	unreachable := ProbeGRPC("127.0.0.1:1", "scope.core", 20*time.Millisecond)
	if unreachable.Status != "UNREACHABLE" || unreachable.Error == "" || !strings.Contains(unreachable.Address, "127.0.0.1") {
		t.Fatalf("expected unreachable result, got %+v", unreachable)
	}
}
