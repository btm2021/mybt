class ReplayEngine {
    constructor(chartManager) {
        this.chartManager = chartManager;
        this.data = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.speed = 5; // Default speed multiplier
        this.intervalId = null;
        this.botATR = new BotATRIndicator(30, 14, 2.0);
        
        this.baseDelay = 1000; // Base delay in milliseconds (1 second)
    }

    // Load data for replay
    loadData(data) {
        this.data = data;
        this.reset();
    }

    // Reset replay to beginning
    reset() {
        this.currentIndex = 0;
        this.isPlaying = false;
        this.clearInterval();
        this.botATR.reset();
        this.chartManager.clearChart();
    }

    // Start replay from beginning
    startReplay() {
        console.log('ReplayEngine.startReplay called');
        console.log('Data length:', this.data.length);
        this.reset();
        console.log('After reset - currentIndex:', this.currentIndex);
        const stepResult = this.step(); // Show first candle
        console.log('Step result:', stepResult);
        console.log('After step - currentIndex:', this.currentIndex);
    }

    // Step forward one candle
    step() {
        if (this.currentIndex >= this.data.length) {
            this.stop();
            return false;
        }

        const currentCandle = this.data[this.currentIndex];
        
        // Calculate ATR indicators
        const atrResult = this.botATR.calculateIncremental(currentCandle);
        
        // Update chart with current candle
        this.chartManager.addCandle(currentCandle);
        
        // Update Trail1 and Trail2 lines
        this.chartManager.addTrail1Point(atrResult.ema);
        this.chartManager.addTrail2Point(atrResult.trail);

        this.currentIndex++;
        
        // Update progress
        this.updateProgress();
        
        // Check if replay is complete
        if (this.currentIndex >= this.data.length) {
            this.stop();
            return false;
        }
        
        return true;
    }

    // Start auto play
    play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        const delay = this.baseDelay / this.speed;
        
        this.intervalId = setInterval(() => {
            if (!this.step()) {
                this.stop();
            }
        }, delay);
    }

    // Pause auto play
    pause() {
        this.isPlaying = false;
        this.clearInterval();
    }

    // Stop replay
    stop() {
        this.isPlaying = false;
        this.clearInterval();
    }

    // Set replay speed
    setSpeed(speed) {
        this.speed = speed;
        
        // If currently playing, restart with new speed
        if (this.isPlaying) {
            this.pause();
            this.play();
        }
    }

    // Clear interval
    clearInterval() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // Update progress display
    updateProgress() {
        const progressElement = document.getElementById('progress');
        if (progressElement) {
            const percentage = ((this.currentIndex / this.data.length) * 100).toFixed(1);
            progressElement.textContent = `${this.currentIndex}/${this.data.length} (${percentage}%)`;
        }
    }

    // Get current state
    getState() {
        return {
            isPlaying: this.isPlaying,
            currentIndex: this.currentIndex,
            totalCandles: this.data.length,
            speed: this.speed,
            isComplete: this.currentIndex >= this.data.length,
            hasData: this.data.length > 0,
            canStep: this.currentIndex < this.data.length
        };
    }

    // Check if replay can step forward
    canStep() {
        return this.currentIndex < this.data.length;
    }

    // Check if replay has data
    hasData() {
        return this.data.length > 0;
    }
}