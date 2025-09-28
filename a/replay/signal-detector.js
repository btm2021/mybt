/**
 * Signal Detection System for ATR Dynamic Trailing Stop Strategy
 * Detects crossovers between Trail1 (EMA) and Trail2 (ATR Trailing Stop)
 */

/**
 * SignalDetector Class
 * Analyzes Trail1/Trail2 crossovers and generates LONG/SHORT signals
 */
class SignalDetector {
    constructor() {
        // State tracking for crossover detection
        this.previousTrail1 = null;
        this.previousTrail2 = null;
        this.currentDirection = 'NONE'; // 'LONG', 'SHORT', or 'NONE'
        
        // Signal validation parameters
        this.minCrossoverThreshold = 0.0001; // Minimum difference to consider a valid crossover
        this.signalDelayCandles = 1; // Number of candles to wait before entry execution
        
        // Signal timing and validation
        this.pendingSignals = []; // Queue of signals waiting for delay
        this.lastSignalTime = null; // Timestamp of last signal to prevent rapid signals
        this.minSignalInterval = 60000; // Minimum time between signals (1 minute in ms)
        this.noiseFilterEnabled = true; // Enable noise filtering
        this.volatilityThreshold = 0.002; // Threshold for volatility-based filtering
        
        // Candle tracking for delay logic
        this.candleHistory = []; // Store recent candles for delay processing
        this.maxHistoryLength = 10; // Maximum candles to keep in history
        
        // Debugging
        this.debugMode = false;
    }
    
    /**
     * Detect crossover between Trail1 and Trail2 with timing and validation
     * @param {number} currentTrail1 - Current Trail1 (EMA) value
     * @param {number} currentTrail2 - Current Trail2 (ATR Trailing Stop) value
     * @param {number} timestamp - Current candle timestamp
     * @param {number} candleIndex - Current candle index in the dataset
     * @param {Object} candle - Full candle data for validation (optional)
     * @returns {Signal|null} - Signal object if crossover detected and validated, null otherwise
     */
    detectCrossover(currentTrail1, currentTrail2, timestamp, candleIndex, candle = null) {
        // Process any pending signals first (check if delay period has passed)
        const readySignal = this.processPendingSignals(candleIndex);
        
        // Validate inputs
        if (!this.isValidInput(currentTrail1, currentTrail2, timestamp, candleIndex)) {
            return readySignal;
        }
        
        // Store candle data for delay processing
        if (candle) {
            this.addCandleToHistory(candle, currentTrail1, currentTrail2, timestamp, candleIndex);
        }
        
        // Need previous values to detect crossover
        if (this.previousTrail1 === null || this.previousTrail2 === null) {
            this.updatePreviousValues(currentTrail1, currentTrail2);
            return readySignal;
        }
        
        let detectedSignal = null;
        
        // Check for LONG signal: Trail1 crosses above Trail2
        if (this.isLongCrossover(currentTrail1, currentTrail2)) {
            detectedSignal = this.createSignal('LONG', timestamp, currentTrail1, currentTrail2, candleIndex);
        }
        // Check for SHORT signal: Trail2 crosses above Trail1
        else if (this.isShortCrossover(currentTrail1, currentTrail2)) {
            detectedSignal = this.createSignal('SHORT', timestamp, currentTrail1, currentTrail2, candleIndex);
        }
        
        // Validate and queue the signal if detected
        if (detectedSignal && this.validateSignal(detectedSignal, candle)) {
            this.queueSignalForDelay(detectedSignal);
            this.currentDirection = detectedSignal.type;
            
            if (this.debugMode) {
                console.log(`${detectedSignal.type} signal queued for delay:`, {
                    prevTrail1: this.previousTrail1,
                    prevTrail2: this.previousTrail2,
                    currentTrail1,
                    currentTrail2,
                    timestamp,
                    candleIndex,
                    delayCandles: this.signalDelayCandles
                });
            }
        }
        
        // Update previous values for next iteration
        this.updatePreviousValues(currentTrail1, currentTrail2);
        
        // Return any signal that's ready after delay
        return readySignal;
    }
    
    /**
     * Create a signal object with enhanced data
     */
    createSignal(type, timestamp, trail1Value, trail2Value, candleIndex) {
        const signal = new Signal(type, timestamp, trail1Value, trail2Value, candleIndex);
        
        // Add additional timing information
        signal.detectionTime = timestamp;
        signal.delayCandles = this.signalDelayCandles;
        signal.executionCandleIndex = candleIndex + this.signalDelayCandles;
        
        return signal;
    }
    
    /**
     * Validate signal to prevent false positives
     */
    validateSignal(signal, candle) {
        // Check minimum time interval between signals
        if (this.lastSignalTime && (signal.timestamp - this.lastSignalTime) < this.minSignalInterval) {
            if (this.debugMode) {
                console.log('Signal rejected: too soon after last signal');
            }
            return false;
        }
        
        // Noise filtering based on volatility
        if (this.noiseFilterEnabled && candle && this.isNoiseSignal(signal, candle)) {
            if (this.debugMode) {
                console.log('Signal rejected: identified as noise');
            }
            return false;
        }
        
        // Additional validation: ensure crossover magnitude is significant
        const crossoverMagnitude = Math.abs(signal.trail1Value - signal.trail2Value);
        if (crossoverMagnitude < this.minCrossoverThreshold) {
            if (this.debugMode) {
                console.log('Signal rejected: crossover magnitude too small');
            }
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if signal is likely noise based on recent volatility
     */
    isNoiseSignal(signal, candle) {
        if (!candle || this.candleHistory.length < 3) {
            return false; // Not enough data to determine
        }
        
        // Calculate recent volatility
        const recentCandles = this.candleHistory.slice(-3);
        const volatility = this.calculateVolatility(recentCandles);
        
        // If volatility is very high, crossover might be noise
        return volatility > this.volatilityThreshold;
    }
    
    /**
     * Calculate volatility from recent candles
     */
    calculateVolatility(candles) {
        if (candles.length < 2) return 0;
        
        const priceChanges = [];
        for (let i = 1; i < candles.length; i++) {
            const change = Math.abs(candles[i].close - candles[i-1].close) / candles[i-1].close;
            priceChanges.push(change);
        }
        
        // Return average price change as volatility measure
        return priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    }
    
    /**
     * Queue signal for delay processing
     */
    queueSignalForDelay(signal) {
        this.pendingSignals.push({
            signal: signal,
            queuedAtCandle: signal.candleIndex,
            readyAtCandle: signal.candleIndex + this.signalDelayCandles
        });
        
        this.lastSignalTime = signal.timestamp;
    }
    
    /**
     * Process pending signals and return any that are ready
     */
    processPendingSignals(currentCandleIndex) {
        if (this.pendingSignals.length === 0) {
            return null;
        }
        
        // Check if any signals are ready (delay period has passed)
        const readySignalIndex = this.pendingSignals.findIndex(
            pending => currentCandleIndex >= pending.readyAtCandle
        );
        
        if (readySignalIndex >= 0) {
            const readyPending = this.pendingSignals.splice(readySignalIndex, 1)[0];
            const readySignal = readyPending.signal;
            
            // Update signal with execution timing
            readySignal.executionTime = Date.now();
            readySignal.actualExecutionCandleIndex = currentCandleIndex;
            
            if (this.debugMode) {
                console.log(`Signal ready for execution after ${this.signalDelayCandles} candle delay:`, {
                    type: readySignal.type,
                    detectionCandle: readyPending.queuedAtCandle,
                    executionCandle: currentCandleIndex,
                    delay: currentCandleIndex - readyPending.queuedAtCandle
                });
            }
            
            return readySignal;
        }
        
        return null;
    }
    
    /**
     * Add candle to history for validation and delay processing
     */
    addCandleToHistory(candle, trail1, trail2, timestamp, candleIndex) {
        const candleData = {
            ...candle,
            trail1: trail1,
            trail2: trail2,
            timestamp: timestamp,
            candleIndex: candleIndex
        };
        
        this.candleHistory.push(candleData);
        
        // Keep only recent candles
        if (this.candleHistory.length > this.maxHistoryLength) {
            this.candleHistory.shift();
        }
    }
    
    /**
     * Check if current values represent a LONG crossover
     * Trail1 crosses above Trail2 (Trail1 was below or equal, now above)
     */
    isLongCrossover(currentTrail1, currentTrail2) {
        const prevTrail1BelowOrEqual = this.previousTrail1 <= this.previousTrail2;
        const currentTrail1Above = currentTrail1 > currentTrail2;
        const crossoverMagnitude = Math.abs(currentTrail1 - currentTrail2);
        
        return prevTrail1BelowOrEqual && 
               currentTrail1Above && 
               crossoverMagnitude >= this.minCrossoverThreshold;
    }
    
    /**
     * Check if current values represent a SHORT crossover
     * Trail2 crosses above Trail1 (Trail2 was below or equal, now above)
     */
    isShortCrossover(currentTrail1, currentTrail2) {
        const prevTrail2BelowOrEqual = this.previousTrail2 <= this.previousTrail1;
        const currentTrail2Above = currentTrail2 > currentTrail1;
        const crossoverMagnitude = Math.abs(currentTrail2 - currentTrail1);
        
        return prevTrail2BelowOrEqual && 
               currentTrail2Above && 
               crossoverMagnitude >= this.minCrossoverThreshold;
    }
    
    /**
     * Validate input parameters
     */
    isValidInput(trail1, trail2, timestamp, candleIndex) {
        if (typeof trail1 !== 'number' || isNaN(trail1) || !isFinite(trail1)) {
            if (this.debugMode) console.warn('Invalid Trail1 value:', trail1);
            return false;
        }
        
        if (typeof trail2 !== 'number' || isNaN(trail2) || !isFinite(trail2)) {
            if (this.debugMode) console.warn('Invalid Trail2 value:', trail2);
            return false;
        }
        
        if (typeof timestamp !== 'number' || timestamp <= 0) {
            if (this.debugMode) console.warn('Invalid timestamp:', timestamp);
            return false;
        }
        
        if (typeof candleIndex !== 'number' || candleIndex < 0) {
            if (this.debugMode) console.warn('Invalid candleIndex:', candleIndex);
            return false;
        }
        
        return true;
    }
    
    /**
     * Update previous values for next crossover detection
     */
    updatePreviousValues(trail1, trail2) {
        this.previousTrail1 = trail1;
        this.previousTrail2 = trail2;
    }
    
    /**
     * Get current direction based on last detected signal
     * @returns {'LONG'|'SHORT'|'NONE'}
     */
    getCurrentDirection() {
        return this.currentDirection;
    }
    
    /**
     * Get previous Trail values
     * @returns {Object} - {trail1: number, trail2: number}
     */
    getPreviousValues() {
        return {
            trail1: this.previousTrail1,
            trail2: this.previousTrail2
        };
    }
    
    /**
     * Reset the signal detector state
     */
    reset() {
        this.previousTrail1 = null;
        this.previousTrail2 = null;
        this.currentDirection = 'NONE';
        this.pendingSignals = [];
        this.lastSignalTime = null;
        this.candleHistory = [];
        
        if (this.debugMode) {
            console.log('SignalDetector reset');
        }
    }
    
    /**
     * Enable or disable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    
    /**
     * Set minimum crossover threshold for signal validation
     */
    setMinCrossoverThreshold(threshold) {
        if (typeof threshold === 'number' && threshold >= 0) {
            this.minCrossoverThreshold = threshold;
        }
    }
    
    /**
     * Set signal delay in candles (1-candle delay logic)
     */
    setSignalDelayCandles(delay) {
        if (typeof delay === 'number' && delay >= 0) {
            this.signalDelayCandles = delay;
        }
    }
    
    /**
     * Set minimum time interval between signals (in milliseconds)
     */
    setMinSignalInterval(interval) {
        if (typeof interval === 'number' && interval >= 0) {
            this.minSignalInterval = interval;
        }
    }
    
    /**
     * Enable or disable noise filtering
     */
    setNoiseFilterEnabled(enabled) {
        this.noiseFilterEnabled = enabled;
    }
    
    /**
     * Set volatility threshold for noise filtering
     */
    setVolatilityThreshold(threshold) {
        if (typeof threshold === 'number' && threshold >= 0) {
            this.volatilityThreshold = threshold;
        }
    }
    
    /**
     * Get current configuration
     */
    getConfig() {
        return {
            minCrossoverThreshold: this.minCrossoverThreshold,
            signalDelayCandles: this.signalDelayCandles,
            minSignalInterval: this.minSignalInterval,
            noiseFilterEnabled: this.noiseFilterEnabled,
            volatilityThreshold: this.volatilityThreshold,
            debugMode: this.debugMode
        };
    }
    
    /**
     * Get pending signals count
     */
    getPendingSignalsCount() {
        return this.pendingSignals.length;
    }
    
    /**
     * Get pending signals (for debugging)
     */
    getPendingSignals() {
        return [...this.pendingSignals];
    }
    
    /**
     * Check if detector is ready (has previous values)
     */
    isReady() {
        return this.previousTrail1 !== null && this.previousTrail2 !== null;
    }
    
    /**
     * Get candle history length
     */
    getCandleHistoryLength() {
        return this.candleHistory.length;
    }
}