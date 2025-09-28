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
                    color: '#000000',
                },
                textColor: '#ffffff',
                fontSize: 11,
            },
            grid: {
                vertLines: {
                    color: '#333333',
                },
                horzLines: {
                    color: '#333333',
                },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#333333',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
                mode: LightweightCharts.PriceScaleMode.Normal,
                autoScale: true,
            },
            timeScale: {
                borderColor: '#333333',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
                barSpacing: 6,
            },
        });

        // Create candlestick series
        this.candlestickSeries = this.chart.addCandlestickSeries({
            upColor: '#00ff00',
            downColor: '#ff0000',
            borderVisible: false,
            wickUpColor: '#00ff00',
            wickDownColor: '#ff0000',
            borderUpColor: '#00ff00',
            borderDownColor: '#ff0000',
        });

        // Create Trail1 series (EMA)
        this.trail1Series = this.chart.addLineSeries({
            color: '#00ff00',
            lineWidth: 2,
            title: 'Trail1 (EMA)',
        });

        // Create Trail2 series (ATR Trailing Stop)
        this.trail2Series = this.chart.addLineSeries({
            color: '#ff0000',
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
        if (this.candlestickSeries && data && data.length > 0) {
            // Determine precision based on price range
            const prices = data.map(d => d.close);
            const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
            
            let precision = 2;
            let minMove = 0.01;
            
            if (avgPrice < 1) {
                precision = 6;
                minMove = 0.0001;
            } else if (avgPrice < 10) {
                precision = 4;
                minMove = 0.0001;
            } else if (avgPrice < 100) {
                precision = 3;
                minMove = 0.001;
            }
            
            // Update chart options with better price formatting
            this.chart.applyOptions({
                rightPriceScale: {
                    borderColor: '#cccccc',
                    scaleMargins: {
                        top: 0.1,
                        bottom: 0.1,
                    },
                    mode: LightweightCharts.PriceScaleMode.Normal,
                    autoScale: true,
                },
                localization: {
                    priceFormatter: (price) => {
                        return price.toFixed(precision);
                    },
                },
            });
            
            // Update candlestick series with proper precision
            this.candlestickSeries.applyOptions({
                priceFormat: {
                    type: 'price',
                    precision: precision,
                    minMove: minMove,
                },
            });
            
            this.candlestickSeries.setData(data);
        }
    }

    // Set all Trail1 data at once
    setTrail1Data(data) {
        if (this.trail1Series && data && data.length > 0) {
            // Determine precision based on data values
            const values = data.map(d => d.value);
            const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
            
            let precision = 2;
            let minMove = 0.01;
            
            if (avgValue < 1) {
                precision = 6;
                minMove = 0.0001;
            } else if (avgValue < 10) {
                precision = 4;
                minMove = 0.0001;
            } else if (avgValue < 100) {
                precision = 3;
                minMove = 0.001;
            }
            
            this.trail1Series.applyOptions({
                priceFormat: {
                    type: 'price',
                    precision: precision,
                    minMove: minMove,
                },
            });
            
            this.trail1Series.setData(data);
        }
    }

    // Set all Trail2 data at once
    setTrail2Data(data) {
        if (this.trail2Series && data && data.length > 0) {
            // Determine precision based on data values
            const values = data.map(d => d.value);
            const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
            
            let precision = 2;
            let minMove = 0.01;
            
            if (avgValue < 1) {
                precision = 6;
                minMove = 0.0001;
            } else if (avgValue < 10) {
                precision = 4;
                minMove = 0.0001;
            } else if (avgValue < 100) {
                precision = 3;
                minMove = 0.001;
            }
            
            this.trail2Series.applyOptions({
                priceFormat: {
                    type: 'price',
                    precision: precision,
                    minMove: minMove,
                },
            });
            
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