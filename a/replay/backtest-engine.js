/**
 * Backtest Configuration Interface
 * Defines all configurable parameters for the backtest system
 */
class BacktestConfig {
    constructor(options = {}) {
        // Trading parameters
        this.initialCapital = options.initialCapital || 200; // USDT
        this.leverage = options.leverage || 20; // 20x leverage
        this.winThreshold = options.winThreshold || 25; // 25% ROE for win classification
        
        // Control parameters
        this.pauseOnSignal = options.pauseOnSignal || false;
        
        // ATR Indicator parameters
        this.emaLength = options.emaLength || 30;
        this.atrLength = options.atrLength || 14;
        this.atrMultiplier = options.atrMultiplier || 2.0;
    }
    
    // Create a copy of the configuration
    clone() {
        return new BacktestConfig({
            initialCapital: this.initialCapital,
            leverage: this.leverage,
            winThreshold: this.winThreshold,
            pauseOnSignal: this.pauseOnSignal,
            emaLength: this.emaLength,
            atrLength: this.atrLength,
            atrMultiplier: this.atrMultiplier
        });
    }
    
    // Validate configuration values
    validate() {
        const errors = [];
        
        if (this.initialCapital <= 0) {
            errors.push('Initial capital must be greater than 0');
        }
        
        if (this.leverage <= 0 || this.leverage > 100) {
            errors.push('Leverage must be between 1 and 100');
        }
        
        if (this.winThreshold <= 0) {
            errors.push('Win threshold must be greater than 0');
        }
        
        if (this.emaLength <= 0) {
            errors.push('EMA length must be greater than 0');
        }
        
        if (this.atrLength <= 0) {
            errors.push('ATR length must be greater than 0');
        }
        
        if (this.atrMultiplier <= 0) {
            errors.push('ATR multiplier must be greater than 0');
        }
        
        return errors;
    }
}

/**
 * Signal Interface
 * Represents a trading signal detected by the system
 */
class Signal {
    constructor(type, timestamp, trail1Value, trail2Value, candleIndex) {
        this.type = type; // 'LONG' or 'SHORT'
        this.timestamp = timestamp;
        this.trail1Value = trail1Value;
        this.trail2Value = trail2Value;
        this.candleIndex = candleIndex;
        this.id = this.generateId();
    }
    
    generateId() {
        return `signal_${this.timestamp}_${this.type}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Backtest Statistics Interface
 * Contains all statistical data about the backtest performance
 */
class BacktestStats {
    constructor() {
        this.totalEntries = 0;
        this.winCount = 0;
        this.lossCount = 0;
        this.winRate = 0;
        
        this.totalPnL = 0;
        this.averagePnL = 0;
        this.bestEntry = null;
        this.worstEntry = null;
        
        this.averageROE = 0;
        this.maxROE = 0;
        this.maxDrawdown = 0;
        
        this.currentDrawdown = 0;
        this.totalTradingTime = 0;
    }
    
    // Update statistics based on entries
    update(entries) {
        this.totalEntries = entries.length;
        
        if (entries.length === 0) {
            this.reset();
            return;
        }
        
        // Calculate win/loss counts
        this.winCount = entries.filter(entry => entry.isWin()).length;
        this.lossCount = this.totalEntries - this.winCount;
        this.winRate = this.totalEntries > 0 ? (this.winCount / this.totalEntries) * 100 : 0;
        
        // Calculate PnL statistics
        const closedEntries = entries.filter(entry => entry.status === 'CLOSED');
        this.totalPnL = closedEntries.reduce((sum, entry) => sum + (entry.finalPnL || 0), 0);
        this.averagePnL = closedEntries.length > 0 ? this.totalPnL / closedEntries.length : 0;
        
        // Find best and worst entries
        if (closedEntries.length > 0) {
            this.bestEntry = closedEntries.reduce((best, entry) => 
                (entry.finalPnL || 0) > (best.finalPnL || 0) ? entry : best
            );
            this.worstEntry = closedEntries.reduce((worst, entry) => 
                (entry.finalPnL || 0) < (worst.finalPnL || 0) ? entry : worst
            );
        }
        
        // Calculate ROE statistics
        const roeValues = closedEntries.map(entry => entry.finalROE || 0);
        this.averageROE = roeValues.length > 0 ? roeValues.reduce((sum, roe) => sum + roe, 0) / roeValues.length : 0;
        this.maxROE = Math.max(0, ...entries.map(entry => entry.maxROE));
        
        // Calculate trading time
        this.totalTradingTime = closedEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    }
    
    reset() {
        this.totalEntries = 0;
        this.winCount = 0;
        this.lossCount = 0;
        this.winRate = 0;
        this.totalPnL = 0;
        this.averagePnL = 0;
        this.bestEntry = null;
        this.worstEntry = null;
        this.averageROE = 0;
        this.maxROE = 0;
        this.maxDrawdown = 0;
        this.currentDrawdown = 0;
        this.totalTradingTime = 0;
    }
}

/**
 * Event System for Backtest Components
 * Provides a simple event emitter for component communication
 */
class BacktestEventEmitter {
    constructor() {
        this.events = {};
    }
    
    // Subscribe to an event
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }
    
    // Unsubscribe from an event
    off(eventName, callback) {
        if (!this.events[eventName]) return;
        
        const index = this.events[eventName].indexOf(callback);
        if (index > -1) {
            this.events[eventName].splice(index, 1);
        }
    }
    
    // Emit an event
    emit(eventName, ...args) {
        if (!this.events[eventName]) return;
        
        this.events[eventName].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event handler for ${eventName}:`, error);
            }
        });
    }
    
    // Remove all listeners for an event
    removeAllListeners(eventName) {
        if (eventName) {
            delete this.events[eventName];
        } else {
            this.events = {};
        }
    }
    
    // Get list of event names
    getEventNames() {
        return Object.keys(this.events);
    }
    
    // Get listener count for an event
    getListenerCount(eventName) {
        return this.events[eventName] ? this.events[eventName].length : 0;
    }
}

/**
 * Main Backtest Engine Class
 * Coordinates all backtest components and manages the overall backtest lifecycle
 */
class BacktestEngine {
    constructor(replayEngine, chartManager) {
        this.replayEngine = replayEngine;
        this.chartManager = chartManager;
        
        // Configuration
        this.config = new BacktestConfig();
        
        // Event system
        this.eventEmitter = new BacktestEventEmitter();
        
        // State
        this.isRunning = false;
        this.statistics = new BacktestStats();
        
        // Components (will be initialized when needed)
        this.signalDetector = null;
        this.entryManager = null;
        this.pnlCalculator = null;
        this.backtestUI = null;
        
        // Initialize event listeners
        this.initializeEventListeners();
    }
    
    // Initialize event listeners for replay engine integration
    initializeEventListeners() {
        // Listen for replay engine events if available
        if (this.replayEngine && typeof this.replayEngine.on === 'function') {
            this.replayEngine.on('candleUpdate', (candle, atrData) => {
                this.onCandleUpdate(candle, atrData);
            });
        }
    }
    
    // Configuration management
    setConfig(config) {
        if (!(config instanceof BacktestConfig)) {
            throw new Error('Config must be an instance of BacktestConfig');
        }
        
        const errors = config.validate();
        if (errors.length > 0) {
            throw new Error('Invalid configuration: ' + errors.join(', '));
        }
        
        this.config = config.clone();
        this.eventEmitter.emit('configChanged', this.config);
    }
    
    getConfig() {
        return this.config.clone();
    }
    
    // Backtest lifecycle control
    start() {
        if (this.isRunning) {
            console.warn('Backtest is already running');
            return;
        }
        
        this.isRunning = true;
        this.statistics.reset();
        
        this.eventEmitter.emit('backtestStarted');
        console.log('Backtest started with config:', this.config);
    }
    
    stop() {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        this.eventEmitter.emit('backtestStopped');
        console.log('Backtest stopped');
    }
    
    reset() {
        this.stop();
        this.statistics.reset();
        this.eventEmitter.emit('backtestReset');
        console.log('Backtest reset');
    }
    
    // Event handlers
    onCandleUpdate(candle, atrData) {
        if (!this.isRunning) return;
        
        try {
            this.eventEmitter.emit('candleProcessed', candle, atrData);
        } catch (error) {
            console.error('Error processing candle update:', error);
            this.eventEmitter.emit('error', error);
        }
    }
    
    onSignalDetected(signal) {
        if (!this.isRunning) return;
        
        try {
            // Handle pause on signal if enabled
            if (this.config.pauseOnSignal && this.replayEngine) {
                if (typeof this.replayEngine.pause === 'function') {
                    this.replayEngine.pause();
                }
            }
            
            this.eventEmitter.emit('signalDetected', signal);
        } catch (error) {
            console.error('Error handling signal:', error);
            this.eventEmitter.emit('error', error);
        }
    }
    
    // State queries
    isBacktestRunning() {
        return this.isRunning;
    }
    
    getStatistics() {
        return this.statistics;
    }
    
    // Event system access
    on(eventName, callback) {
        this.eventEmitter.on(eventName, callback);
    }
    
    off(eventName, callback) {
        this.eventEmitter.off(eventName, callback);
    }
    
    emit(eventName, ...args) {
        this.eventEmitter.emit(eventName, ...args);
    }
    
    // Component registration (for future use)
    setSignalDetector(signalDetector) {
        this.signalDetector = signalDetector;
    }
    
    setEntryManager(entryManager) {
        this.entryManager = entryManager;
    }
    
    setPnLCalculator(pnlCalculator) {
        this.pnlCalculator = pnlCalculator;
    }
    
    setBacktestUI(backtestUI) {
        this.backtestUI = backtestUI;
    }
}