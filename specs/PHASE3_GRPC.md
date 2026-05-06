# Phase 3: gRPC Inter-Service Communication — Codex Build Spec

> **Scope**: Add gRPC as a secondary communication layer between Core ↔ Content ↔ Intel ↔ Metrics.
> **Prerequisites**: Phases 1–2 complete. All services running.
> **Pattern**: Each service keeps its existing REST API. gRPC is added as a **parallel internal channel** for high-frequency inter-service calls.

---

## Overview

| Caller → Callee | Current (REST) | gRPC Replacement |
|---|---|---|
| Core → Content | `GET /api/content/spots/{id}` | `SpotService.GetSpot()` |
| Content → Intel | `POST /api/intel/sentiment` | `IntelService.AnalyzeSentiment()` |
| Content → Intel | `POST /api/intel/classify-image` | `IntelService.ClassifyImage()` |
| Intel → Content | `GET /api/content/spots/` | `SpotService.ListSpots()` |
| Metrics → All | `GET /health` (HTTP) | gRPC health check protocol |

---

## 1. Proto Definitions

**Create directory**: `scope-proto/`

### 1a. Buf config

**File**: `scope-proto/buf.yaml` (NEW)

```yaml
version: v2
modules:
  - path: proto
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
```

**File**: `scope-proto/buf.gen.yaml` (NEW)

```yaml
version: v2
plugins:
  # Python (Content + Intel)
  - remote: buf.build/protocolbuffers/python
    out: gen/python
  - remote: buf.build/grpc/python
    out: gen/python

  # Go (Metrics)
  - remote: buf.build/protocolbuffers/go
    out: gen/go
    opt: paths=source_relative
  - remote: buf.build/grpc/go
    out: gen/go
    opt: paths=source_relative

  # C# (Core)
  - remote: buf.build/protocolbuffers/csharp
    out: gen/csharp
  - remote: buf.build/grpc/csharp
    out: gen/csharp
```

### 1b. Common types

**File**: `scope-proto/proto/scope/v1/common.proto` (NEW)

```protobuf
syntax = "proto3";
package scope.v1;

option csharp_namespace = "Scope.Proto.V1";
option go_package = "scope-proto/gen/go/scope/v1;scopev1";

import "google/protobuf/timestamp.proto";

message Pagination {
  int32 page = 1;
  int32 page_size = 2;
}

message PaginatedMeta {
  int32 total = 1;
  int32 page = 2;
  int32 page_size = 3;
  int32 total_pages = 4;
}

message GeoPoint {
  double latitude = 1;
  double longitude = 2;
}

message HealthCheckRequest {
  string service = 1;
}

message HealthCheckResponse {
  enum Status {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
  }
  Status status = 1;
  string version = 2;
  google.protobuf.Timestamp timestamp = 3;
}
```

### 1c. Spot service

**File**: `scope-proto/proto/scope/v1/spot.proto` (NEW)

```protobuf
syntax = "proto3";
package scope.v1;

option csharp_namespace = "Scope.Proto.V1";
option go_package = "scope-proto/gen/go/scope/v1;scopev1";

import "scope/v1/common.proto";
import "google/protobuf/timestamp.proto";

service SpotService {
  rpc GetSpot(GetSpotRequest) returns (Spot);
  rpc ListSpots(ListSpotsRequest) returns (ListSpotsResponse);
  rpc SearchSpots(SearchSpotsRequest) returns (ListSpotsResponse);
  rpc GetSpotsByIds(GetSpotsByIdsRequest) returns (ListSpotsResponse);
}

message Spot {
  string id = 1;
  string name = 2;
  string description = 3;
  GeoPoint location = 4;
  string category = 5;
  repeated string tags = 6;
  string creator_id = 7;
  float avg_rating = 8;
  int32 review_count = 9;
  google.protobuf.Timestamp created_at = 10;
  google.protobuf.Timestamp updated_at = 11;
}

message GetSpotRequest {
  string id = 1;
}

message ListSpotsRequest {
  Pagination pagination = 1;
  string category = 2;
  string creator_id = 3;
  string ordering = 4;
}

message ListSpotsResponse {
  repeated Spot spots = 1;
  PaginatedMeta meta = 2;
}

message SearchSpotsRequest {
  string query = 1;
  int32 limit = 2;
  GeoPoint center = 3;
  string radius = 4;
}

message GetSpotsByIdsRequest {
  repeated string ids = 1;
}
```

### 1d. Intel service

**File**: `scope-proto/proto/scope/v1/intel.proto` (NEW)

```protobuf
syntax = "proto3";
package scope.v1;

option csharp_namespace = "Scope.Proto.V1";
option go_package = "scope-proto/gen/go/scope/v1;scopev1";

service IntelService {
  rpc AnalyzeSentiment(SentimentRequest) returns (SentimentResponse);
  rpc AnalyzeSentimentBatch(SentimentBatchRequest) returns (SentimentBatchResponse);
  rpc ClassifyImage(ClassifyImageRequest) returns (ClassifyImageResponse);
  rpc PredictTrip(PredictTripRequest) returns (PredictTripResponse);
  rpc GetRecommendations(RecommendationRequest) returns (RecommendationResponse);
}

message SentimentRequest {
  string text = 1;
  string review_id = 2;
}

message SentimentResponse {
  string label = 1;
  float score = 2;
  float normalized_score = 3;
  string review_id = 4;
}

message SentimentBatchRequest {
  repeated string texts = 1;
}

message SentimentBatchResponse {
  repeated SentimentResponse results = 1;
}

message ClassifyImageRequest {
  string url = 1;
  bytes image_data = 2;
  string photo_id = 3;
  int32 top_k = 4;
}

message ClassifyImageResponse {
  repeated ImageTag tags = 1;
  string photo_id = 2;
}

message ImageTag {
  string tag = 1;
  float confidence = 2;
}

message PredictTripRequest {
  int32 num_spots = 1;
  float total_distance_km = 2;
  float avg_rating = 3;
  int32 num_outdoor = 4;
  int32 num_food = 5;
  int32 num_cultural = 6;
  int32 month = 7;
}

message PredictTripResponse {
  float predicted_days = 1;
  float predicted_cost_usd = 2;
  float confidence = 3;
  string source = 4;
}

message RecommendationRequest {
  string user_id = 1;
  int32 limit = 2;
}

message RecommendationResponse {
  repeated RecommendedSpot spots = 1;
}

message RecommendedSpot {
  string spot_id = 1;
  float score = 2;
  string source = 3;
}
```

### 1e. User service

**File**: `scope-proto/proto/scope/v1/user.proto` (NEW)

```protobuf
syntax = "proto3";
package scope.v1;

option csharp_namespace = "Scope.Proto.V1";
option go_package = "scope-proto/gen/go/scope/v1;scopev1";

import "scope/v1/common.proto";
import "google/protobuf/timestamp.proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc GetUsersByIds(GetUsersByIdsRequest) returns (GetUsersResponse);
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}

message User {
  string id = 1;
  string username = 2;
  string email = 3;
  string display_name = 4;
  string avatar_url = 5;
  google.protobuf.Timestamp created_at = 6;
}

message GetUserRequest {
  string id = 1;
}

message GetUsersByIdsRequest {
  repeated string ids = 1;
}

message GetUsersResponse {
  repeated User users = 1;
}
```

---

## 2. Code Generation Script

**File**: `scope-proto/generate.sh` (NEW)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Install buf if not present
if ! command -v buf &>/dev/null; then
  echo "Installing buf..."
  curl -sSL https://github.com/bufbuild/buf/releases/latest/download/buf-$(uname -s)-$(uname -m) -o /usr/local/bin/buf
  chmod +x /usr/local/bin/buf
fi

cd "$(dirname "$0")"

# Clean old generated code
rm -rf gen/

# Generate
buf generate

echo "Generated code in gen/"
ls -la gen/
```

**File**: `scope-proto/generate.ps1` (NEW — PowerShell for Windows)

```powershell
# Generate gRPC code from proto definitions
$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot

# Clean
if (Test-Path gen) { Remove-Item -Recurse -Force gen }

# Generate using buf
buf generate

Write-Host "Generated code in gen/"
Get-ChildItem gen -Recurse | Select-Object FullName

Pop-Location
```

---

## 3. Python gRPC Server — Content API

### 3a. Dependencies

**File**: `scope_content/requirements.txt` (MODIFY — append)

```
grpcio>=1.72.0
grpcio-tools>=1.72.0
grpcio-reflection>=1.72.0
grpcio-health-checking>=1.72.0
```

### 3b. gRPC server

**File**: `scope_content/common/grpc_server.py` (NEW)

```python
"""gRPC server for Content API — SpotService implementation."""

import logging
import threading
from concurrent import futures

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

logger = logging.getLogger(__name__)

GRPC_PORT = 50051


def serve_grpc():
    """Start the gRPC server in a background thread."""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    # Register SpotService
    from common.grpc_services import SpotServiceServicer, add_spot_service_to_server
    add_spot_service_to_server(SpotServiceServicer(), server)

    # Health checking
    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set("scope.v1.SpotService", health_pb2.HealthCheckResponse.SERVING)

    # Reflection (for grpcurl / debugging)
    SERVICE_NAMES = (
        health_pb2.DESCRIPTOR.services_by_name["Health"].full_name,
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(SERVICE_NAMES, server)

    server.add_insecure_port(f"[::]:{GRPC_PORT}")
    server.start()
    logger.info("gRPC server started on port %d", GRPC_PORT)

    return server


def start_grpc_background():
    """Start gRPC server in a daemon thread."""
    thread = threading.Thread(target=_run_grpc, daemon=True)
    thread.start()
    return thread


def _run_grpc():
    server = serve_grpc()
    server.wait_for_termination()
```

### 3c. SpotService implementation

**File**: `scope_content/common/grpc_services.py` (NEW)

```python
"""gRPC service implementations for Content API."""

import logging

import grpc

logger = logging.getLogger(__name__)

# NOTE: These imports reference the generated protobuf code.
# After running `buf generate`, copy the generated Python files from
# scope-proto/gen/python/ into scope_content/common/proto/
# The imports below assume that path structure.

# For initial scaffolding, define the servicer interface manually.
# Replace with generated imports after code generation.


class SpotServiceServicer:
    """Implements the SpotService gRPC interface."""

    def GetSpot(self, request, context):
        """Fetch a single spot by ID."""
        from spots.models import Spot

        try:
            spot = Spot.objects.get(id=request.id)
            return self._spot_to_proto(spot)
        except Spot.DoesNotExist:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Spot {request.id} not found")
            return None

    def ListSpots(self, request, context):
        """List spots with pagination."""
        from spots.models import Spot

        page = request.pagination.page if request.pagination.page > 0 else 1
        page_size = request.pagination.page_size if request.pagination.page_size > 0 else 20
        offset = (page - 1) * page_size

        qs = Spot.objects.all()
        if request.category:
            qs = qs.filter(category=request.category)
        if request.creator_id:
            qs = qs.filter(creator_id=request.creator_id)
        if request.ordering:
            qs = qs.order_by(request.ordering)

        total = qs.count()
        spots = qs[offset:offset + page_size]

        # Build response — replace with generated message classes
        return {
            "spots": [self._spot_to_dict(s) for s in spots],
            "meta": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size,
            },
        }

    def SearchSpots(self, request, context):
        """Search spots using Elasticsearch."""
        from common.search import get_es_client, SPOT_INDEX

        client = get_es_client()
        if client is None:
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details("Search service unavailable")
            return None

        body = {
            "query": {"multi_match": {"query": request.query, "fields": ["name^3", "description", "tags^2"]}},
            "size": request.limit or 20,
        }

        result = client.search(index=SPOT_INDEX, body=body)
        spots = [hit["_source"] for hit in result["hits"]["hits"]]

        return {"spots": spots, "meta": {"total": result["hits"]["total"]["value"]}}

    def GetSpotsByIds(self, request, context):
        """Fetch multiple spots by IDs."""
        from spots.models import Spot
        spots = Spot.objects.filter(id__in=list(request.ids))
        return {"spots": [self._spot_to_dict(s) for s in spots]}

    @staticmethod
    def _spot_to_dict(spot) -> dict:
        return {
            "id": str(spot.id),
            "name": spot.name,
            "description": getattr(spot, "description", "") or "",
            "category": getattr(spot, "category", "") or "",
            "creator_id": str(spot.creator_id) if spot.creator_id else "",
            "avg_rating": float(getattr(spot, "avg_rating", 0) or 0),
            "review_count": int(getattr(spot, "review_count", 0) or 0),
        }

    @staticmethod
    def _spot_to_proto(spot):
        """Convert a Django Spot model to a protobuf Spot message."""
        # Replace with actual generated proto message after buf generate
        return SpotServiceServicer._spot_to_dict(spot)


def add_spot_service_to_server(servicer, server):
    """Register the SpotService servicer with the gRPC server.

    NOTE: After generating code with buf, replace this with the actual
    generated add_SpotServiceServicer_to_server function.
    """
    # Placeholder — replace with generated code
    logger.info("SpotService registered (placeholder — replace with generated code)")
```

### 3d. Start gRPC on Django startup

In the Content API's `AppConfig.ready()` method, add:

```python
import os
if os.environ.get("GRPC_ENABLED", "true").lower() == "true":
    from common.grpc_server import start_grpc_background
    start_grpc_background()
```

### 3e. Docker — expose gRPC port

In `docker-compose.yml`, add to the `content` service:

```yaml
    expose:
      - "8000"
      - "50051"  # gRPC
```

---

## 4. Python gRPC Server — Intel API

### 4a. Dependencies

**File**: `scope_intel/requirements.txt` (MODIFY — append)

```
grpcio>=1.72.0
grpcio-tools>=1.72.0
grpcio-reflection>=1.72.0
grpcio-health-checking>=1.72.0
```

### 4b. gRPC server

**File**: `scope_intel/app/grpc_server.py` (NEW)

Follow the same pattern as Content API's `grpc_server.py`, but register `IntelServiceServicer` instead.

### 4c. IntelService implementation

**File**: `scope_intel/app/grpc_services.py` (NEW)

```python
"""gRPC IntelService implementation."""

import grpc
import logging

logger = logging.getLogger(__name__)


class IntelServiceServicer:
    """Implements the IntelService gRPC interface."""

    def AnalyzeSentiment(self, request, context):
        from app.ml.inference.sentiment import analyze_sentiment
        result = analyze_sentiment(request.text)
        return {
            "label": result["label"],
            "score": result["score"],
            "normalized_score": result["normalized_score"],
            "review_id": request.review_id,
        }

    def AnalyzeSentimentBatch(self, request, context):
        from app.ml.inference.sentiment import analyze_batch
        results = analyze_batch(list(request.texts))
        return {"results": results}

    def ClassifyImage(self, request, context):
        from app.ml.inference.tagger import classify_image, classify_from_url
        top_k = request.top_k or 5

        if request.url:
            tags = classify_from_url(request.url, top_k)
        elif request.image_data:
            tags = classify_image(request.image_data, top_k)
        else:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Provide url or image_data")
            return None

        return {"tags": tags, "photo_id": request.photo_id}

    def PredictTrip(self, request, context):
        from app.ml.inference.predictor import predict_trip
        features = {
            "num_spots": request.num_spots,
            "total_distance_km": request.total_distance_km,
            "avg_rating": request.avg_rating,
            "num_outdoor": request.num_outdoor,
            "num_food": request.num_food,
            "num_cultural": request.num_cultural,
            "month": request.month,
        }
        return predict_trip(features)

    def GetRecommendations(self, request, context):
        from app.ml.inference.recommender import recommend_spots
        spots = recommend_spots(request.user_id, request.limit or 10)
        return {"spots": spots}
```

### 4d. Docker — expose gRPC port

Add to `intel` service in `docker-compose.yml`:
```yaml
    expose:
      - "5000"
      - "50052"  # gRPC
```

---

## 5. Go gRPC Client — Metrics Agent

### 5a. Dependencies

**File**: `scope-metrics/go.mod` (MODIFY — add)

```
google.golang.org/grpc v1.72.0
google.golang.org/protobuf v1.36.8
```

Run `go mod tidy` after.

### 5b. gRPC health probes

**File**: `scope-metrics/internal/grpc_probes.go` (NEW)

```go
package internal

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

type GRPCProbeResult struct {
	Service string `json:"service"`
	Address string `json:"address"`
	Status  string `json:"status"`
	Latency string `json:"latency"`
	Error   string `json:"error,omitempty"`
}

func ProbeGRPC(address string, serviceName string, timeout time.Duration) GRPCProbeResult {
	result := GRPCProbeResult{Service: serviceName, Address: address}
	start := time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	conn, err := grpc.DialContext(ctx, address, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		result.Status = "UNREACHABLE"
		result.Error = err.Error()
		result.Latency = time.Since(start).String()
		return result
	}
	defer conn.Close()

	client := healthpb.NewHealthClient(conn)
	resp, err := client.Check(ctx, &healthpb.HealthCheckRequest{Service: serviceName})
	result.Latency = time.Since(start).String()

	if err != nil {
		result.Status = "ERROR"
		result.Error = err.Error()
		return result
	}

	result.Status = resp.Status.String()
	return result
}
```

---

## 6. C# gRPC Client — Core API

### 6a. NuGet packages

Add to `Scope.Core.API.csproj`:

```xml
<PackageReference Include="Grpc.Net.Client" Version="2.67.0" />
<PackageReference Include="Google.Protobuf" Version="3.29.3" />
<PackageReference Include="Grpc.Tools" Version="2.72.0" PrivateAssets="All" />
```

### 6b. Proto file reference

Add to `Scope.Core.API.csproj`:

```xml
<ItemGroup>
  <Protobuf Include="..\..\scope-proto\proto\scope\v1\*.proto" GrpcServices="Client" ProtoRoot="..\..\scope-proto\proto" />
</ItemGroup>
```

### 6c. gRPC client service

**File**: `Scope.Core/Scope.Core.Infrastructure/GrpcClients/ContentGrpcClient.cs` (NEW)

```csharp
using Grpc.Net.Client;
using Scope.Proto.V1;

namespace Scope.Core.Infrastructure.GrpcClients;

public class ContentGrpcClient : IDisposable
{
    private readonly GrpcChannel _channel;
    private readonly SpotService.SpotServiceClient _spotClient;

    public ContentGrpcClient(string address = "http://content:50051")
    {
        _channel = GrpcChannel.ForAddress(address);
        _spotClient = new SpotService.SpotServiceClient(_channel);
    }

    public async Task<Spot?> GetSpotAsync(string id, CancellationToken ct = default)
    {
        var request = new GetSpotRequest { Id = id };
        return await _spotClient.GetSpotAsync(request, cancellationToken: ct);
    }

    public async Task<ListSpotsResponse> ListSpotsAsync(int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var request = new ListSpotsRequest
        {
            Pagination = new Pagination { Page = page, PageSize = pageSize }
        };
        return await _spotClient.ListSpotsAsync(request, cancellationToken: ct);
    }

    public void Dispose() => _channel?.Dispose();
}
```

Register in DI (`Program.cs` or `Startup.cs`):
```csharp
builder.Services.AddSingleton(new ContentGrpcClient(
    builder.Configuration.GetValue<string>("CONTENT_GRPC_URL") ?? "http://content:50051"
));
```

---

## Validation Checklist

```powershell
# 1. Generate proto code
cd scope-proto; .\generate.ps1

# 2. Rebuild all services
docker compose up --build -d

# 3. Test Content gRPC with grpcurl
grpcurl -plaintext localhost:50051 list
grpcurl -plaintext localhost:50051 grpc.health.v1.Health/Check

# 4. Test Intel gRPC
grpcurl -plaintext localhost:50052 list

# 5. Verify Go metrics probes compile
cd scope-metrics; go build ./...

# 6. Verify .NET Core builds
cd Scope.Core; dotnet build Scope.Core.sln
```

---

## Files Created / Modified Summary

| Action | File |
|---|---|
| NEW | `scope-proto/buf.yaml` |
| NEW | `scope-proto/buf.gen.yaml` |
| NEW | `scope-proto/proto/scope/v1/common.proto` |
| NEW | `scope-proto/proto/scope/v1/spot.proto` |
| NEW | `scope-proto/proto/scope/v1/intel.proto` |
| NEW | `scope-proto/proto/scope/v1/user.proto` |
| NEW | `scope-proto/generate.sh` |
| NEW | `scope-proto/generate.ps1` |
| NEW | `scope_content/common/grpc_server.py` |
| NEW | `scope_content/common/grpc_services.py` |
| NEW | `scope_intel/app/grpc_server.py` |
| NEW | `scope_intel/app/grpc_services.py` |
| NEW | `scope-metrics/internal/grpc_probes.go` |
| NEW | `Scope.Core/Scope.Core.Infrastructure/GrpcClients/ContentGrpcClient.cs` |
| MODIFY | `scope_content/requirements.txt` (add grpcio) |
| MODIFY | `scope_intel/requirements.txt` (add grpcio) |
| MODIFY | `scope-metrics/go.mod` (add grpc) |
| MODIFY | `Scope.Core/Scope.Core.API/Scope.Core.API.csproj` (add Grpc packages + proto refs) |
| MODIFY | `docker-compose.yml` (expose gRPC ports) |
