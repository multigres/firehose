# SupaFirehose - Postgres Connection Pooler Demo Application

## Overview

A load testing and demonstration application for showcasing the capabilities of a Postgres connection pooler. The application provides a visual interface to control workload parameters and observe real-time performance metrics.

### Goals

1. Generate configurable read/write load against a Postgres database through the connection pooler
2. Provide real-time visibility into latency, throughput, and error rates
3. Allow dynamic adjustment of workload parameters without restarting
4. Present a polished UI suitable for demos and presentations

---

## Architecture

SupaFirehose is a single Go binary with the React frontend embedded using `go:embed`. One binary, one port, zero coordination.

```
┌─────────────────────────────────────────────────────────────┐
│                  supafirehose binary                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Embedded React App (go:embed)           │   │
│  │         (Vite + React + Tailwind + Recharts)         │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐   │   │
│  │  │   Controls   │  │    Charts    │  │  Stats   │   │   │
│  │  │ • Pool Size  │  │ • Latency    │  │ • Total  │   │   │
│  │  │ • Read QPS   │  │ • Throughput │  │ • Errors │   │   │
│  │  │ • Write QPS  │  │ • Error Rate │  │ • Conns  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 HTTP Server (:8080)                  │   │
│  │                                                      │   │
│  │  GET  /*           → Static frontend files           │   │
│  │  GET  /api/status  → Current status                  │   │
│  │  POST /api/config  → Update configuration            │   │
│  │  POST /api/start   → Start load generator            │   │
│  │  POST /api/stop    → Stop load generator             │   │
│  │  POST /api/reset   → Reset metrics                   │   │
│  │  GET  /ws/metrics  → WebSocket metrics stream        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Load Controller                     │   │
│  │                                                      │   │
│  │  • Manages worker goroutines                         │   │
│  │  • Enforces rate limits (x/time/rate)               │   │
│  │  • Dynamically adjusts concurrency                   │   │
│  │                                                      │   │
│  │  ┌─────────────────┐    ┌─────────────────┐         │   │
│  │  │  Read Workers   │    │  Write Workers  │         │   │
│  │  │  SELECT by ID   │    │  INSERT rows    │         │   │
│  │  └────────┬────────┘    └────────┬────────┘         │   │
│  │           │                      │                   │   │
│  │           └──────────┬───────────┘                   │   │
│  │                      ▼                               │   │
│  │           ┌─────────────────┐                        │   │
│  │           │ Metrics Collect │                        │   │
│  │           │ • latency hist  │                        │   │
│  │           │ • error counts  │                        │   │
│  │           │ • QPS tracking  │                        │   │
│  │           └─────────────────┘                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ TCP (Postgres protocol)
                              ▼
                    ┌───────────────────┐
                    │  Connection       │
                    │  Pooler (proxy)   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    PostgreSQL     │
                    └───────────────────┘
```

---

## Database Schema

### Table: `users`

A simple table for read/write operations.

```sql
CREATE TABLE IF NOT EXISTS users (
    id         BIGSERIAL PRIMARY KEY,
    username   VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for point reads by ID (primary key handles this)
-- Optional: Add some seed data for reads
INSERT INTO users (username, email)
SELECT 
    'user_' || i,
    'user_' || i || '@example.com'
FROM generate_series(1, 100000) AS i;
```

### Workload Operations

**Read Query (Point Select)**
```sql
SELECT id, username, email, created_at 
FROM users 
WHERE id = $1;
```
- `$1` is a random ID within the known range (1 to max_id)
- Simulates typical point-read workload

**Write Query (Insert)**
```sql
INSERT INTO users (username, email) 
VALUES ($1, $2)
RETURNING id;
```
- `$1` = randomly generated username
- `$2` = randomly generated email
- Returns the new ID (useful for metrics)

---

## API Design

### HTTP Endpoints

#### `GET /api/status`

Returns current system status.

**Response:**
```json
{
  "running": true,
  "config": {
    "connections": 50,
    "read_qps": 1000,
    "write_qps": 200
  },
  "uptime_seconds": 3600
}
```

#### `POST /api/config`

Update workload configuration. Changes apply immediately.

**Request:**
```json
{
  "connections": 100,
  "read_qps": 5000,
  "write_qps": 1000
}
```

**Response:**
```json
{
  "ok": true,
  "config": {
    "connections": 100,
    "read_qps": 5000,
    "write_qps": 1000
  }
}
```

#### `POST /api/start`

Start the load generator.

**Response:**
```json
{
  "ok": true,
  "message": "Load generator started"
}
```

#### `POST /api/stop`

Stop the load generator gracefully.

**Response:**
```json
{
  "ok": true,
  "message": "Load generator stopped"
}
```

#### `POST /api/reset`

Reset all metrics counters to zero.

**Response:**
```json
{
  "ok": true,
  "message": "Metrics reset"
}
```

### WebSocket Endpoint

#### `GET /ws/metrics`

Streams metrics to the client every 100ms.

**Message Format (server → client):**
```json
{
  "timestamp": 1699900000000,
  "reads": {
    "qps": 4850,
    "latency_p50_ms": 1.2,
    "latency_p99_ms": 8.5,
    "latency_avg_ms": 2.1,
    "errors": 0
  },
  "writes": {
    "qps": 980,
    "latency_p50_ms": 2.5,
    "latency_p99_ms": 15.2,
    "latency_avg_ms": 4.3,
    "errors": 2
  },
  "totals": {
    "queries": 15847293,
    "errors": 127,
    "error_rate": 0.0008
  },
  "pool": {
    "active_connections": 48,
    "idle_connections": 2,
    "waiting_requests": 0
  }
}
```

---

## Go Backend Design

### Project Structure

```
supafirehose/
├── main.go                 # Entry point, server setup, embeds frontend
├── config/
│   └── config.go           # Configuration structs and loading
├── api/
│   ├── router.go           # HTTP router setup
│   ├── handlers.go         # HTTP handlers
│   └── websocket.go        # WebSocket handler and hub
├── load/
│   ├── controller.go       # Main load controller
│   ├── reader.go           # Read worker implementation
│   ├── writer.go           # Write worker implementation
│   └── pool.go             # Worker pool management
├── metrics/
│   ├── collector.go        # Metrics collection and aggregation
│   ├── histogram.go        # Latency histogram implementation
│   └── types.go            # Metric types
├── db/
│   └── postgres.go         # Database connection setup
└── frontend/               # React app (embedded at build time)
    ├── src/
    ├── index.html
    ├── package.json
    └── dist/               # Built static files (embedded)
```

### Embedding the Frontend

```go
package main

import (
    "embed"
    "io/fs"
    "net/http"
)

//go:embed frontend/dist/*
var frontendFS embed.FS

func main() {
    // Strip "frontend/dist" prefix for serving
    staticFiles, _ := fs.Sub(frontendFS, "frontend/dist")
    
    mux := http.NewServeMux()
    
    // API routes
    mux.HandleFunc("/api/", apiHandler)
    mux.HandleFunc("/ws/metrics", wsHandler)
    
    // Static frontend (fallback)
    mux.Handle("/", http.FileServer(http.FS(staticFiles)))
    
    http.ListenAndServe(":8080", mux)
}
```

### Key Components

#### Config

```go
type Config struct {
    // Database
    DatabaseURL string `env:"DATABASE_URL" default:"postgres://localhost:5432/pooler_demo"`
    
    // Server
    HTTPPort int `env:"HTTP_PORT" default:"8080"`
    
    // Load defaults
    DefaultConnections int `env:"DEFAULT_CONNECTIONS" default:"10"`
    DefaultReadQPS     int `env:"DEFAULT_READ_QPS" default:"100"`
    DefaultWriteQPS    int `env:"DEFAULT_WRITE_QPS" default:"10"`
    
    // Limits
    MaxConnections int `env:"MAX_CONNECTIONS" default:"500"`
    MaxReadQPS     int `env:"MAX_READ_QPS" default:"50000"`
    MaxWriteQPS    int `env:"MAX_WRITE_QPS" default:"10000"`
}
```

#### Load Controller

```go
type LoadController struct {
    mu sync.RWMutex
    
    running bool
    config  LoadConfig
    
    // Worker management
    readWorkers  []*Worker
    writeWorkers []*Worker
    
    // Rate limiters
    readLimiter  *rate.Limiter
    writeLimiter *rate.Limiter
    
    // Metrics
    metrics *MetricsCollector
    
    // Database
    pool *pgxpool.Pool
    
    // Shutdown
    ctx    context.Context
    cancel context.CancelFunc
}

type LoadConfig struct {
    Connections int
    ReadQPS     int
    WriteQPS    int
}
```

#### Metrics Collector

```go
type MetricsCollector struct {
    mu sync.RWMutex
    
    // Current window (last 100ms)
    readLatencies  *Histogram
    writeLatencies *Histogram
    readCount      int64
    writeCount     int64
    readErrors     int64
    writeErrors    int64
    
    // Totals
    totalQueries int64
    totalErrors  int64
    
    // Subscribers (WebSocket connections)
    subscribers map[*WebSocketClient]bool
}

type MetricsSnapshot struct {
    Timestamp int64          `json:"timestamp"`
    Reads     OperationStats `json:"reads"`
    Writes    OperationStats `json:"writes"`
    Totals    TotalStats     `json:"totals"`
    Pool      PoolStats      `json:"pool"`
}

type OperationStats struct {
    QPS         int     `json:"qps"`
    LatencyP50  float64 `json:"latency_p50_ms"`
    LatencyP99  float64 `json:"latency_p99_ms"`
    LatencyAvg  float64 `json:"latency_avg_ms"`
    Errors      int64   `json:"errors"`
}
```

#### Worker Implementation

```go
func (w *ReadWorker) Run(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        default:
            // Wait for rate limiter
            if err := w.limiter.Wait(ctx); err != nil {
                return
            }
            
            // Execute query
            start := time.Now()
            id := rand.Int63n(w.maxID) + 1
            
            var user User
            err := w.pool.QueryRow(ctx, 
                "SELECT id, username, email, created_at FROM users WHERE id = $1",
                id,
            ).Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt)
            
            latency := time.Since(start)
            
            // Report metrics
            w.metrics.RecordRead(latency, err)
        }
    }
}
```

### Concurrency Model

1. **Worker Pool**: N goroutines per operation type (reads/writes)
2. **Rate Limiting**: Shared `rate.Limiter` per operation type distributes QPS across workers
3. **Dynamic Adjustment**: 
   - Config changes update rate limiters immediately
   - Connection count changes spawn/stop workers gracefully
4. **Metrics Pipeline**: Workers send results to collector via buffered channel

---

## Frontend Design

### Tech Stack

- **Vite** — Fast dev server and build
- **React 18** — UI framework
- **Tailwind CSS** — Styling
- **Recharts** — Charts

### Component Structure

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── ControlPanel.jsx      # Sliders and buttons
│   │   ├── MetricsCharts.jsx     # All charts
│   │   ├── LatencyChart.jsx      # P50/P99 latency over time
│   │   ├── ThroughputChart.jsx   # QPS over time
│   │   ├── ErrorChart.jsx        # Error rate over time
│   │   ├── StatsPanel.jsx        # Summary statistics
│   │   └── ConnectionStatus.jsx  # WebSocket status indicator
│   ├── hooks/
│   │   ├── useWebSocket.js       # WebSocket connection hook
│   │   └── useMetricsHistory.js  # Rolling metrics buffer
│   ├── api/
│   │   └── client.js             # HTTP API client
│   └── utils/
│       └── formatting.js         # Number/time formatting
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  FIREHOSE 🔥                              ● Connected   ▶ ON │    │
│  └─────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────────────────────┐  │
│  │                     │  │                                     │  │
│  │   CONTROL PANEL     │  │         LATENCY (ms)                │  │
│  │                     │  │    ┌─────────────────────────────┐  │  │
│  │   Connections       │  │    │  ~~~~~/\~~~~    P99         │  │  │
│  │   ═══════●═══  100  │  │    │ ~~~~/  \~~~    P50 ----    │  │  │
│  │                     │  │    │ ──/────\──                  │  │  │
│  │   Read QPS          │  │    └─────────────────────────────┘  │  │
│  │   ═══════════●  5K  │  │                                     │  │
│  │                     │  ├─────────────────────────────────────┤  │
│  │   Write QPS         │  │                                     │  │
│  │   ═════●══════  1K  │  │         THROUGHPUT (qps)            │  │
│  │                     │  │    ┌─────────────────────────────┐  │  │
│  │   ┌─────┐ ┌─────┐   │  │    │ ████████████  Reads        │  │  │
│  │   │START│ │RESET│   │  │    │ ████         Writes        │  │  │
│  │   └─────┘ └─────┘   │  │    └─────────────────────────────┘  │  │
│  │                     │  │                                     │  │
│  └─────────────────────┘  └─────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │  STATS                                                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │ QUERIES  │ │  ERRORS  │ │ ERR RATE │ │ ACTIVE CONNS     │ │  │
│  │  │ 1.54M    │ │ 127      │ │ 0.008%   │ │ 98/100           │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. User adjusts slider → HTTP POST to `/api/config`
2. Backend updates rate limiters → Workers adjust immediately
3. Workers report metrics → Collector aggregates
4. Every 100ms → Collector broadcasts via WebSocket
5. Frontend receives → Updates charts with new data point
6. Charts maintain rolling 60-second window (600 data points)

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://localhost:5432/pooler_demo` | Postgres connection string (points to pooler) |
| `HTTP_PORT` | `8080` | Port for HTTP/WebSocket server |
| `DEFAULT_CONNECTIONS` | `10` | Initial connection count |
| `DEFAULT_READ_QPS` | `100` | Initial read QPS |
| `DEFAULT_WRITE_QPS` | `10` | Initial write QPS |
| `MAX_CONNECTIONS` | `500` | Maximum allowed connections |
| `MAX_READ_QPS` | `50000` | Maximum read QPS |
| `MAX_WRITE_QPS` | `10000` | Maximum write QPS |
| `METRICS_INTERVAL` | `100ms` | How often to push metrics |
| `MAX_USER_ID` | `100000` | Max ID for random reads (based on seed data) |

---

## Build & Run

### Development

```bash
# Terminal 1: Frontend dev server (with hot reload)
cd frontend
npm install
npm run dev

# Terminal 2: Backend (proxy frontend to Vite dev server)
go run . --dev
```

### Production Build

```bash
# Build frontend
cd frontend
npm run build

# Build single binary (embeds frontend/dist)
cd ..
go build -o supafirehose .

# Run
./supafirehose
```

---

## Future Enhancements (Out of Scope for V1)

- [ ] Multiple query patterns (range scans, joins, transactions)
- [ ] Configurable query complexity
- [ ] Connection churn simulation (open/close rapidly)
- [ ] Chaos testing (kill connections, add latency)
- [ ] Export metrics to Prometheus
- [ ] Compare multiple pooler configurations side-by-side
- [ ] Latency heatmap visualization
- [ ] Record and replay workload profiles