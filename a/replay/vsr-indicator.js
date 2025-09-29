/**
 * VSR (Volume Resistant Support) Indicator
 * Based on PineScript implementation
 * 
 * Calculates volume-based support and resistance levels
 * by analyzing volume changes and their standard deviation
 */
class VSRIndicator {
    constructor(length = 10, threshold = 10) {
        this.length = length;
        this.threshold = threshold;
        this.reset();
    }

    // Reset all calculations
    reset() {
        this.volumeHistory = [];
        this.changeHistory = [];
        this.stdevHistory = [];
        this.upperLevels = [];
        this.lowerLevels = [];
        this.isInitialized = false;
    }

    /**
     * Calculate standard deviation for array
     * @param {Array} values - Array of values
     * @param {number} length - Period length
     * @returns {number} Standard deviation
     */
    calculateStandardDeviation(values, length) {
        if (values.length < length) {
            return 0;
        }

        const slice = values.slice(-length);
        const mean = slice.reduce((sum, val) => sum + val, 0) / slice.length;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / slice.length;
        
        return Math.sqrt(variance);
    }

    /**
     * Get value when condition was true (equivalent to ta.valuewhen)
     * @param {boolean} condition - Condition to check
     * @param {number} value - Value to return when condition is true
     * @param {Array} history - History of values
     * @returns {number} Value when condition was last true
     */
    getValueWhen(condition, value, history) {
        if (condition) {
            return value;
        }
        
        // Return last stored value if condition is false
        return history.length > 0 ? history[history.length - 1] : null;
    }

    /**
     * Calculate VSR levels for a single candle
     * @param {Object} candle - OHLCV candle data
     * @returns {Object} VSR calculation result
     */
    calculate(candle) {
        const { high, low, close, volume, time } = candle;
        
        // Store current volume
        this.volumeHistory.push(volume);
        
        // Calculate volume change (current / previous - 1)
        let change = 0;
        if (this.volumeHistory.length > 1) {
            const prevVolume = this.volumeHistory[this.volumeHistory.length - 2];
            if (prevVolume > 0) {
                change = (volume / prevVolume) - 1;
            }
        }
        
        this.changeHistory.push(change);
        
        // Calculate standard deviation of changes
        const stdev = this.calculateStandardDeviation(this.changeHistory, this.length);
        this.stdevHistory.push(stdev);
        
        // Calculate difference (change / stdev[1])
        let difference = 0;
        if (this.stdevHistory.length > 1) {
            const prevStdev = this.stdevHistory[this.stdevHistory.length - 2];
            if (prevStdev > 0) {
                difference = change / prevStdev;
            }
        }
        
        // Calculate signal (absolute value of difference)
        const signal = Math.abs(difference);
        
        // Determine if signal exceeds threshold
        const signalExceedsThreshold = signal > this.threshold;
        
        // Calculate upper and lower levels
        let upper = null;
        let lower = null;
        
        if (signalExceedsThreshold) {
            // When signal > threshold, store current high/low levels
            upper = Math.max(high, close);
            lower = Math.min(low, close);
        }
        
        // Update level histories using valuewhen logic
        const currentUpper = this.getValueWhen(signalExceedsThreshold, upper, this.upperLevels);
        const currentLower = this.getValueWhen(signalExceedsThreshold, lower, this.lowerLevels);
        
        // Store levels if they exist
        if (currentUpper !== null) {
            this.upperLevels.push(currentUpper);
        }
        if (currentLower !== null) {
            this.lowerLevels.push(currentLower);
        }
        
        // Keep history within reasonable bounds
        const maxHistory = this.length * 3;
        if (this.volumeHistory.length > maxHistory) {
            this.volumeHistory = this.volumeHistory.slice(-maxHistory);
            this.changeHistory = this.changeHistory.slice(-maxHistory);
            this.stdevHistory = this.stdevHistory.slice(-maxHistory);
        }
        
        return {
            time: time,
            upper: currentUpper,
            lower: currentLower,
            signal: signal,
            change: change,
            difference: difference,
            signalExceedsThreshold: signalExceedsThreshold
        };
    }

    /**
     * Calculate VSR for array of candles
     * @param {Array} candles - Array of OHLCV candles
     * @returns {Object} VSR data arrays
     */
    calculateArray(candles) {
        this.reset();
        const results = {
            upper: [],
            lower: [],
            fillArea: [],
            signals: []
        };
        
        let currentUpper = null;
        let currentLower = null;
        
        for (let i = 0; i < candles.length; i++) {
            const result = this.calculate(candles[i]);
            
            // Update current levels
            if (result.upper !== null) {
                currentUpper = result.upper;
                results.upper.push({
                    time: result.time,
                    value: result.upper
                });
            }
            
            if (result.lower !== null) {
                currentLower = result.lower;
                results.lower.push({
                    time: result.time,
                    value: result.lower
                });
            }
            
            // Create fill area data when both upper and lower exist
            if (currentUpper !== null && currentLower !== null) {
                results.fillArea.push({
                    time: result.time,
                    value: currentUpper // Area series uses upper as value, lower as baseline
                });
            }
            
            // Store signal data for analysis
            results.signals.push({
                time: result.time,
                signal: result.signal,
                change: result.change,
                stdev: result.stdev,
                signalExceedsThreshold: result.signalExceedsThreshold
            });
        }
        
        return results;
    }

    /**
     * Calculate incrementally (for replay mode)
     * @param {Object} candle - Current candle
     * @returns {Object} Incremental VSR result
     */
    calculateIncremental(candle) {
        const result = this.calculate(candle);
        
        const incrementalResult = {
            upper: null,
            lower: null,
            fillArea: null
        };
        
        if (result.upper !== null) {
            incrementalResult.upper = {
                time: result.time,
                value: result.upper
            };
        }
        
        if (result.lower !== null) {
            incrementalResult.lower = {
                time: result.time,
                value: result.lower
            };
        }
        
        // Create fill area data when both upper and lower exist
        const currentLevels = this.getCurrentLevels();
        if (currentLevels.upper !== null && currentLevels.lower !== null) {
            incrementalResult.fillArea = {
                time: result.time,
                value: currentLevels.upper
            };
        }
        
        return incrementalResult;
    }

    /**
     * Get current VSR levels
     * @returns {Object} Current upper and lower levels
     */
    getCurrentLevels() {
        return {
            upper: this.upperLevels.length > 0 ? this.upperLevels[this.upperLevels.length - 1] : null,
            lower: this.lowerLevels.length > 0 ? this.lowerLevels[this.lowerLevels.length - 1] : null
        };
    }

    /**
     * Check if indicator is ready
     * @returns {boolean} True if indicator has enough data
     */
    isReady() {
        return this.volumeHistory.length >= this.length;
    }

    /**
     * Update parameters
     * @param {number} length - VSR length parameter
     * @param {number} threshold - VSR threshold parameter
     */
    updateParameters(length, threshold) {
        this.length = length;
        this.threshold = threshold;
        this.reset();
    }

    /**
     * Get statistics about VSR signals
     * @returns {Object} VSR statistics
     */
    getStatistics() {
        const totalSignals = this.upperLevels.length + this.lowerLevels.length;
        const avgUpper = this.upperLevels.length > 0 ? 
            this.upperLevels.reduce((sum, val) => sum + val, 0) / this.upperLevels.length : 0;
        const avgLower = this.lowerLevels.length > 0 ? 
            this.lowerLevels.reduce((sum, val) => sum + val, 0) / this.lowerLevels.length : 0;
        
        return {
            totalSignals: totalSignals,
            upperLevels: this.upperLevels.length,
            lowerLevels: this.lowerLevels.length,
            averageUpper: avgUpper,
            averageLower: avgLower,
            currentUpper: this.upperLevels.length > 0 ? this.upperLevels[this.upperLevels.length - 1] : null,
            currentLower: this.lowerLevels.length > 0 ? this.lowerLevels[this.lowerLevels.length - 1] : null
        };
    }
}