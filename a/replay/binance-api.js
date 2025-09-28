class BinanceAPI {
    constructor() {
        this.baseUrl = 'https://fapi.binance.com/fapi/v1';
        this.maxLimit = 1500; // Binance max limit per request
    }

    // Convert timeframe to milliseconds
    timeframeToMs(timeframe) {
        const timeframes = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000
        };
        return timeframes[timeframe] || timeframes['15m'];
    }

    // Calculate batches needed for the requested number of candles
    calculateBatches(totalCandles, timeframe) {
        const batches = [];
        const timeframeMs = this.timeframeToMs(timeframe);
        const now = Date.now();
        
        let remainingCandles = totalCandles;
        let endTime = now;

        while (remainingCandles > 0) {
            const batchSize = Math.min(remainingCandles, this.maxLimit);
            const startTime = endTime - (batchSize * timeframeMs);
            
            batches.unshift({
                startTime,
                endTime: endTime - timeframeMs, // Exclude the endTime candle to avoid overlap
                limit: batchSize
            });
            
            endTime = startTime;
            remainingCandles -= batchSize;
        }

        return batches;
    }

    // Fetch klines data from Binance
    async fetchKlines(symbol, interval, startTime, endTime, limit) {
        const params = new URLSearchParams({
            symbol: symbol.toUpperCase(),
            interval,
            startTime,
            endTime,
            limit
        });

        const url = `${this.baseUrl}/klines?${params}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching klines:', error);
            throw error;
        }
    }

    // Convert Binance kline data to chart format
    formatKlineData(klines) {
        return klines.map(kline => ({
            time: Math.floor(kline[0] / 1000), // Convert to seconds
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5])
        }));
    }

    // Main method to fetch historical data with batching
    async fetchHistoricalData(symbol, timeframe, candleCount, onProgress) {
        try {
            const batches = this.calculateBatches(candleCount, timeframe);
            let allData = [];
            
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                
                if (onProgress) {
                    onProgress(i + 1, batches.length, `Đang tải batch ${i + 1}/${batches.length}...`);
                }
                
                const klines = await this.fetchKlines(
                    symbol,
                    timeframe,
                    batch.startTime,
                    batch.endTime,
                    batch.limit
                );
                
                const formattedData = this.formatKlineData(klines);
                allData = allData.concat(formattedData);
                
                // Small delay to avoid rate limiting
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Remove duplicates and sort by time
            const uniqueData = allData.filter((item, index, arr) => 
                index === 0 || item.time !== arr[index - 1].time
            );
            
            uniqueData.sort((a, b) => a.time - b.time);
            
            return uniqueData.slice(-candleCount); // Return only the requested number of candles
            
        } catch (error) {
            console.error('Error fetching historical data:', error);
            throw error;
        }
    }
}