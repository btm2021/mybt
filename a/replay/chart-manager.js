class ChartManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.chart = null;
        this.candlestickSeries = null;
        this.emaSeries = null;
        this.initialize();
    }

    // Initialize the chart
    initialize() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            throw new Error(`Container with id '${this.containerId}' not found`);
        }

        // Create chart with configuration
        this.chart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: {
                background: {
                    type: 'solid',
                    color: '#ffffff',
                },
                textColor: '#333',
            },
            grid: {
                vertLines: {
                    color: '#e1e1e1',
                },
                horzLines: {
                    color: '#e1e1e1',
                },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#cccccc',
            },
            timeScale: {
                borderColor: '#cccccc',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // Create candlestick series
        this.candlestickSeries = this.chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // Create Trail1 series (EMA)
        this.trail1Series = this.chart.addLineSeries({
            color: '#00C851',
            lineWidth: 2,
            title: 'Trail1 (EMA)',
        });

        // Create Trail2 series (ATR Trailing Stop)
        this.trail2Series = this.chart.addLineSeries({
            color: '#FF4444',
            lineWidth: 2,
            title: 'Trail2 (ATR)',
        });

        // Handle resize
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
    }

    // Handle window resize
    handleResize() {
        const container = document.getElementById(this.containerId);
        if (container && this.chart) {
            this.chart.applyOptions({
                width: container.clientWidth,
                height: container.clientHeight,
            });
        }
    }

    // Clear all data from chart
    clearChart() {
        if (this.candlestickSeries) {
            this.candlestickSeries.setData([]);
        }
        if (this.trail1Series) {
            this.trail1Series.setData([]);
        }
        if (this.trail2Series) {
            this.trail2Series.setData([]);
        }
    }

    // Add a single candle to the chart
    addCandle(candle) {
        if (this.candlestickSeries) {
            this.candlestickSeries.update(candle);
        }
    }

    // Add Trail1 point to the chart
    addTrail1Point(point) {
        if (this.trail1Series) {
            this.trail1Series.update(point);
        }
    }

    // Add Trail2 point to the chart
    addTrail2Point(point) {
        if (this.trail2Series) {
            this.trail2Series.update(point);
        }
    }

    // Set all candlestick data at once
    setCandlestickData(data) {
        if (this.candlestickSeries) {
            this.candlestickSeries.setData(data);
        }
    }

    // Set all Trail1 data at once
    setTrail1Data(data) {
        if (this.trail1Series) {
            this.trail1Series.setData(data);
        }
    }

    // Set all Trail2 data at once
    setTrail2Data(data) {
        if (this.trail2Series) {
            this.trail2Series.setData(data);
        }
    }

    // Fit chart content to visible area
    fitContent() {
        if (this.chart) {
            this.chart.timeScale().fitContent();
        }
    }

    // Get chart instance (for advanced usage)
    getChart() {
        return this.chart;
    }

    // Destroy chart
    destroy() {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
            this.candlestickSeries = null;
            this.trail1Series = null;
            this.trail2Series = null;
        }
        window.removeEventListener('resize', this.handleResize);
    }
}