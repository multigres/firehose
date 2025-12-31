package metrics

import (
	"sort"
	"sync"
	"time"
)

// Histogram collects latency samples and computes percentiles
type Histogram struct {
	mu      sync.Mutex
	samples []float64
}

// NewHistogram creates a new histogram
func NewHistogram() *Histogram {
	return &Histogram{
		samples: make([]float64, 0, 1024),
	}
}

// Record adds a latency sample to the histogram
func (h *Histogram) Record(d time.Duration) {
	h.mu.Lock()
	h.samples = append(h.samples, float64(d.Microseconds())/1000.0) // Convert to ms
	h.mu.Unlock()
}

// Snapshot returns percentiles and clears the histogram
type HistogramSnapshot struct {
	P50   float64
	P99   float64
	Avg   float64
	Count int
}

// SnapshotAndReset returns current percentiles and resets the histogram
func (h *Histogram) SnapshotAndReset() HistogramSnapshot {
	h.mu.Lock()
	defer h.mu.Unlock()

	if len(h.samples) == 0 {
		return HistogramSnapshot{}
	}

	// Sort for percentile calculation
	sorted := make([]float64, len(h.samples))
	copy(sorted, h.samples)
	sort.Float64s(sorted)

	snapshot := HistogramSnapshot{
		P50:   percentile(sorted, 0.50),
		P99:   percentile(sorted, 0.99),
		Avg:   average(sorted),
		Count: len(sorted),
	}

	// Reset samples
	h.samples = h.samples[:0]

	return snapshot
}

// percentile calculates the p-th percentile of sorted data
func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return sorted[0]
	}

	index := p * float64(len(sorted)-1)
	lower := int(index)
	upper := lower + 1

	if upper >= len(sorted) {
		return sorted[len(sorted)-1]
	}

	weight := index - float64(lower)
	return sorted[lower]*(1-weight) + sorted[upper]*weight
}

// average calculates the mean of the data
func average(data []float64) float64 {
	if len(data) == 0 {
		return 0
	}

	var sum float64
	for _, v := range data {
		sum += v
	}
	return sum / float64(len(data))
}
