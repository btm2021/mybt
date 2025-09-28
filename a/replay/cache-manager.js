/**
 * OHLCV Cache Manager using IndexedDB + Dexie.js
 * Manages caching of candlestick data for different symbols and timeframes
 */

class CacheManager {
    constructor() {
        // Initialize Dexie database
        this.db = new Dexie('OHLCVCache');
        
        // Define schema
        this.db.version(1).stores({
            candles: '++id, symbol, timeframe, timestamp, open, high, low, close, volume',
            metadata: 'key, symbol, timeframe, count, lastUpdate, firstTimestamp, lastTimestamp'
        });

        this.db.open().catch(err => {
            console.error('Failed to open database:', err);
        });
    }

    /**
     * Generate cache key for metadata
     */
    getCacheKey(symbol, timeframe) {
        return `${symbol}_${timeframe}`;
    }

    /**
     * Save OHLCV data to cache
     */
    async saveToCache(symbol, timeframe, candles) {
        try {
            const cacheKey = this.getCacheKey(symbol, timeframe);
            
            // Clear existing data for this symbol/timeframe
            await this.db.candles.filter(candle => candle.symbol === symbol && candle.timeframe === timeframe).delete();
            await this.db.metadata.where('key').equals(cacheKey).delete();

            // Prepare candle data
            const candleData = candles.map(candle => ({
                symbol,
                timeframe,
                timestamp: candle.time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume || 0
            }));

            // Save candles
            await this.db.candles.bulkAdd(candleData);

            // Save metadata
            const metadata = {
                key: cacheKey,
                symbol,
                timeframe,
                count: candles.length,
                lastUpdate: Date.now(),
                firstTimestamp: candles[0]?.time || 0,
                lastTimestamp: candles[candles.length - 1]?.time || 0
            };

            await this.db.metadata.add(metadata);

            console.log(`Cached ${candles.length} candles for ${symbol} ${timeframe}`);
            return true;

        } catch (error) {
            console.error('Error saving to cache:', error);
            return false;
        }
    }

    /**
     * Load OHLCV data from cache
     */
    async loadFromCache(symbol, timeframe, requestedCount = null) {
        try {
            const cacheKey = this.getCacheKey(symbol, timeframe);
            
            // Get metadata
            const metadata = await this.db.metadata.where('key').equals(cacheKey).first();
            if (!metadata) {
                return null;
            }

            // Get candles - use filter approach for compatibility
            const allCandles = await this.db.candles
                .filter(candle => candle.symbol === symbol && candle.timeframe === timeframe)
                .sortBy('timestamp');

            // If requested count is specified and less than cached count
            if (requestedCount && requestedCount < allCandles.length) {
                // Get the most recent candles
                const startIndex = Math.max(0, allCandles.length - requestedCount);
                const selectedCandles = allCandles.slice(startIndex);
                
                return {
                    candles: selectedCandles.map(this.formatCandle),
                    metadata: {
                        ...metadata,
                        actualCount: selectedCandles.length,
                        isPartial: true
                    }
                };
            }

            // Return all candles
            return {
                candles: allCandles.map(this.formatCandle),
                metadata: {
                    ...metadata,
                    actualCount: allCandles.length,
                    isPartial: false
                }
            };

        } catch (error) {
            console.error('Error loading from cache:', error);
            return null;
        }
    }

    /**
     * Get cache info for a symbol/timeframe
     */
    async getCacheInfo(symbol, timeframe) {
        try {
            const cacheKey = this.getCacheKey(symbol, timeframe);
            const metadata = await this.db.metadata.where('key').equals(cacheKey).first();
            return metadata;
        } catch (error) {
            console.error('Error getting cache info:', error);
            return null;
        }
    }

    /**
     * Check if we need to fetch more data
     */
    async needsMoreData(symbol, timeframe, requestedCount) {
        try {
            const cacheKey = this.getCacheKey(symbol, timeframe);
            const metadata = await this.db.metadata.where('key').equals(cacheKey).first();
            
            if (!metadata) {
                return { needsFetch: true, reason: 'no_cache' };
            }

            if (metadata.count < requestedCount) {
                return { 
                    needsFetch: true, 
                    reason: 'insufficient_data',
                    cached: metadata.count,
                    requested: requestedCount,
                    additional: requestedCount - metadata.count
                };
            }

            // Check if data is too old (older than 1 hour)
            const oneHour = 60 * 60 * 1000;
            if (Date.now() - metadata.lastUpdate > oneHour) {
                return { 
                    needsFetch: true, 
                    reason: 'data_too_old',
                    lastUpdate: metadata.lastUpdate
                };
            }

            return { needsFetch: false };

        } catch (error) {
            console.error('Error checking cache needs:', error);
            return { needsFetch: true, reason: 'error' };
        }
    }

    /**
     * Extend existing cache with additional data
     */
    async extendCache(symbol, timeframe, newCandles, requestedCount) {
        try {
            const cacheKey = this.getCacheKey(symbol, timeframe);
            
            // Get existing metadata
            const metadata = await this.db.metadata.where('key').equals(cacheKey).first();
            if (!metadata) {
                // No existing cache, save all new data
                return await this.saveToCache(symbol, timeframe, newCandles);
            }

            // Get existing candles to avoid duplicates
            const existingCandles = await this.db.candles
                .filter(candle => candle.symbol === symbol && candle.timeframe === timeframe)
                .sortBy('timestamp');

            // Create a set of existing timestamps for quick lookup
            const existingTimestamps = new Set(existingCandles.map(c => c.timestamp));

            // Filter out duplicates from new candles
            const uniqueNewCandles = newCandles.filter(candle => 
                !existingTimestamps.has(candle.time)
            );

            if (uniqueNewCandles.length > 0) {
                // Prepare new candle data
                const candleData = uniqueNewCandles.map(candle => ({
                    symbol,
                    timeframe,
                    timestamp: candle.time,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume || 0
                }));

                // Add new candles
                await this.db.candles.bulkAdd(candleData);

                // Update metadata
                const totalCount = existingCandles.length + uniqueNewCandles.length;
                const allTimestamps = [...existingCandles.map(c => c.timestamp), ...uniqueNewCandles.map(c => c.time)];
                
                await this.db.metadata.where('key').equals(cacheKey).modify({
                    count: totalCount,
                    lastUpdate: Date.now(),
                    firstTimestamp: Math.min(...allTimestamps),
                    lastTimestamp: Math.max(...allTimestamps)
                });

                console.log(`Extended cache with ${uniqueNewCandles.length} new candles for ${symbol} ${timeframe}`);
            }

            // Return the requested amount of data
            return await this.loadFromCache(symbol, timeframe, requestedCount);

        } catch (error) {
            console.error('Error extending cache:', error);
            return null;
        }
    }

    /**
     * Format candle data for chart
     */
    formatCandle(dbCandle) {
        return {
            time: dbCandle.timestamp,
            open: dbCandle.open,
            high: dbCandle.high,
            low: dbCandle.low,
            close: dbCandle.close,
            volume: dbCandle.volume
        };
    }

    /**
     * Get all cached symbols and their info
     */
    async getAllCachedData() {
        try {
            const allMetadata = await this.db.metadata.toArray();
            return allMetadata.map(meta => ({
                symbol: meta.symbol,
                timeframe: meta.timeframe,
                count: meta.count,
                lastUpdate: meta.lastUpdate,
                firstTimestamp: meta.firstTimestamp,
                lastTimestamp: meta.lastTimestamp,
                size: this.estimateSize(meta.count)
            }));
        } catch (error) {
            console.error('Error getting cached data:', error);
            return [];
        }
    }

    /**
     * Estimate storage size
     */
    estimateSize(candleCount) {
        // Rough estimate: each candle ~100 bytes
        const bytes = candleCount * 100;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /**
     * Delete specific cache entry
     */
    async deleteCacheEntry(symbol, timeframe) {
        try {
            const cacheKey = this.getCacheKey(symbol, timeframe);
            
            await this.db.candles.filter(candle => candle.symbol === symbol && candle.timeframe === timeframe).delete();
            await this.db.metadata.where('key').equals(cacheKey).delete();
            
            console.log(`Deleted cache for ${symbol} ${timeframe}`);
            return true;
        } catch (error) {
            console.error('Error deleting cache entry:', error);
            return false;
        }
    }

    /**
     * Clear all cache
     */
    async clearAllCache() {
        try {
            await this.db.candles.clear();
            await this.db.metadata.clear();
            console.log('All cache cleared');
            return true;
        } catch (error) {
            console.error('Error clearing all cache:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            const allMetadata = await this.db.metadata.toArray();
            const totalCandles = allMetadata.reduce((sum, meta) => sum + meta.count, 0);
            const totalSize = allMetadata.reduce((sum, meta) => sum + (meta.count * 100), 0);
            
            return {
                totalSymbols: allMetadata.length,
                totalCandles,
                totalSize: this.estimateSize(totalCandles)
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return {
                totalSymbols: 0,
                totalCandles: 0,
                totalSize: '0 B'
            };
        }
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.CacheManager = CacheManager;
}