class EMACalculator {
    constructor(period = 50) {
        this.period = period;
        this.multiplier = 2 / (period + 1);
        this.ema = null;
        this.isInitialized = false;
    }

    // Reset the EMA calculator
    reset() {
        this.ema = null;
        this.isInitialized = false;
    }

    // Calculate EMA for a single price point
    calculate(price) {
        if (!this.isInitialized) {
            this.ema = price;
            this.isInitialized = true;
            return this.ema;
        }

        this.ema = (price * this.multiplier) + (this.ema * (1 - this.multiplier));
        return this.ema;
    }

    // Calculate EMA for an array of prices (for initial calculation)
    calculateArray(prices) {
        this.reset();
        const emaValues = [];

        for (let i = 0; i < prices.length; i++) {
            const emaValue = this.calculate(prices[i]);
            emaValues.push({
                time: prices[i].time,
                value: emaValue
            });
        }

        return emaValues;
    }

    // Get current EMA value
    getCurrentValue() {
        return this.ema;
    }

    // Check if EMA is initialized
    isReady() {
        return this.isInitialized;
    }
}