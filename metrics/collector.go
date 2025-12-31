package metrics

import (
	"sync"
	"sync/atomic"
	"time"
)

// Collector aggregates metrics from workers and provides snapshots
type Collector struct {
	mu sync.RWMutex

	// Current window histograms
	readLatencies  *Histogram
	writeLatencies *Histogram

	// Window counters (reset each interval)
	readCount   int64
	writeCount  int64
	readErrors  int64
	writeErrors int64

	// Total counters (never reset except via Reset())
	totalQueries atomic.Int64
	totalErrors  atomic.Int64

	// Pool stats function
	poolStatsFunc func() PoolStats

	// Start time for uptime calculation
	startTime time.Time
}

// NewCollector creates a new metrics collector
func NewCollector(poolStatsFunc func() PoolStats) *Collector {
	return &Collector{
		readLatencies:  NewHistogram(),
		writeLatencies: NewHistogram(),
		poolStatsFunc:  poolStatsFunc,
		startTime:      time.Now(),
	}
}

// RecordRead records a read operation
func (c *Collector) RecordRead(latency time.Duration, err error) {
	c.readLatencies.Record(latency)
	atomic.AddInt64(&c.readCount, 1)
	c.totalQueries.Add(1)

	if err != nil {
		atomic.AddInt64(&c.readErrors, 1)
		c.totalErrors.Add(1)
	}
}

// RecordWrite records a write operation
func (c *Collector) RecordWrite(latency time.Duration, err error) {
	c.writeLatencies.Record(latency)
	atomic.AddInt64(&c.writeCount, 1)
	c.totalQueries.Add(1)

	if err != nil {
		atomic.AddInt64(&c.writeErrors, 1)
		c.totalErrors.Add(1)
	}
}

// Snapshot returns current metrics and resets window counters
func (c *Collector) Snapshot(interval time.Duration) MetricsSnapshot {
	// Get histogram snapshots (this also resets them)
	readHist := c.readLatencies.SnapshotAndReset()
	writeHist := c.writeLatencies.SnapshotAndReset()

	// Get and reset window counters
	readCount := atomic.SwapInt64(&c.readCount, 0)
	writeCount := atomic.SwapInt64(&c.writeCount, 0)
	readErrors := atomic.SwapInt64(&c.readErrors, 0)
	writeErrors := atomic.SwapInt64(&c.writeErrors, 0)

	// Calculate QPS based on actual interval
	intervalSec := interval.Seconds()
	readQPS := float64(readCount) / intervalSec
	writeQPS := float64(writeCount) / intervalSec

	// Get totals
	totalQueries := c.totalQueries.Load()
	totalErrors := c.totalErrors.Load()

	// Calculate error rate
	var errorRate float64
	if totalQueries > 0 {
		errorRate = float64(totalErrors) / float64(totalQueries)
	}

	// Get pool stats
	var poolStats PoolStats
	if c.poolStatsFunc != nil {
		poolStats = c.poolStatsFunc()
	}

	return MetricsSnapshot{
		Timestamp: time.Now().UnixMilli(),
		Reads: OperationStats{
			QPS:        readQPS,
			LatencyP50: readHist.P50,
			LatencyP99: readHist.P99,
			LatencyAvg: readHist.Avg,
			Errors:     readErrors,
		},
		Writes: OperationStats{
			QPS:        writeQPS,
			LatencyP50: writeHist.P50,
			LatencyP99: writeHist.P99,
			LatencyAvg: writeHist.Avg,
			Errors:     writeErrors,
		},
		Totals: TotalStats{
			Queries:   totalQueries,
			Errors:    totalErrors,
			ErrorRate: errorRate,
		},
		Pool: poolStats,
	}
}

// Reset clears all metrics
func (c *Collector) Reset() {
	c.readLatencies.SnapshotAndReset()
	c.writeLatencies.SnapshotAndReset()
	atomic.StoreInt64(&c.readCount, 0)
	atomic.StoreInt64(&c.writeCount, 0)
	atomic.StoreInt64(&c.readErrors, 0)
	atomic.StoreInt64(&c.writeErrors, 0)
	c.totalQueries.Store(0)
	c.totalErrors.Store(0)
	c.startTime = time.Now()
}

// Uptime returns the duration since the collector was created or reset
func (c *Collector) Uptime() time.Duration {
	return time.Since(c.startTime)
}
