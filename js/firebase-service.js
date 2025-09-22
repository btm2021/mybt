window.BacktestApp = window.BacktestApp || {};

(function (app) {
  // Simple Firebase service without authentication
  // Data will be stored in public collections
  
  const COLLECTIONS = {
    SYMBOLS: 'symbols',
    TRADES: 'trades',
    SETTINGS: 'settings'
  };

  // Use a fixed user ID for simplicity (since it's internal app)
  const USER_ID = 'internal-user';

  function getDb() {
    if (!app.firebase || !app.firebase.db) {
      throw new Error('Firebase not initialized');
    }
    return app.firebase.db;
  }

  // Helper function to get user-specific collection reference
  function getUserCollection(collectionName) {
    const db = getDb();
    return db.collection('users').doc(USER_ID).collection(collectionName);
  }

  // Symbol operations
  async function saveSymbol(symbol) {
    try {
      const symbolsRef = getUserCollection(COLLECTIONS.SYMBOLS);
      await symbolsRef.doc(symbol.id).set({
        ...symbol,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return symbol;
    } catch (error) {
      console.error('Error saving symbol:', error);
      throw error;
    }
  }

  async function getSymbols() {
    try {
      const symbolsRef = getUserCollection(COLLECTIONS.SYMBOLS);
      const snapshot = await symbolsRef.orderBy('createdAt', 'desc').get();
      const symbols = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        symbols.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        });
      });
      
      return symbols;
    } catch (error) {
      console.error('Error getting symbols:', error);
      throw error;
    }
  }

  async function deleteSymbol(symbolId) {
    try {
      const db = getDb();
      const batch = db.batch();
      
      // Delete symbol
      const symbolRef = getUserCollection(COLLECTIONS.SYMBOLS).doc(symbolId);
      batch.delete(symbolRef);
      
      // Delete all trades for this symbol
      const tradesRef = getUserCollection(COLLECTIONS.TRADES);
      const tradesSnapshot = await tradesRef.where('symbolId', '==', symbolId).get();
      
      tradesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error deleting symbol:', error);
      throw error;
    }
  }

  // Trade operations
  async function saveTrade(trade, symbolId) {
    try {
      const tradesRef = getUserCollection(COLLECTIONS.TRADES);
      const tradeData = {
        ...trade,
        symbolId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      await tradesRef.doc(trade.id).set(tradeData);
      return trade;
    } catch (error) {
      console.error('Error saving trade:', error);
      throw error;
    }
  }

  async function getTradesForSymbol(symbolId) {
    try {
      const tradesRef = getUserCollection(COLLECTIONS.TRADES);
      const snapshot = await tradesRef
        .where('symbolId', '==', symbolId)
        .orderBy('timestamp', 'asc')
        .get();
      
      const trades = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        trades.push({
          ...data,
          id: doc.id,
          timestamp: data.timestamp || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        });
      });
      
      return trades;
    } catch (error) {
      console.error('Error getting trades:', error);
      throw error;
    }
  }

  async function deleteTrade(tradeId) {
    try {
      const tradeRef = getUserCollection(COLLECTIONS.TRADES).doc(tradeId);
      await tradeRef.delete();
      return true;
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw error;
    }
  }

  async function updateTrade(tradeId, updates) {
    try {
      const tradeRef = getUserCollection(COLLECTIONS.TRADES).doc(tradeId);
      await tradeRef.update({
        ...updates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    }
  }

  // User settings operations
  async function saveUserSettings(settings) {
    try {
      const db = getDb();
      const settingsRef = db.collection('users').doc(USER_ID);
      await settingsRef.set({
        settings: {
          ...settings,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true });
      
      return settings;
    } catch (error) {
      console.error('Error saving user settings:', error);
      throw error;
    }
  }

  async function getUserSettings() {
    try {
      const db = getDb();
      const settingsRef = db.collection('users').doc(USER_ID);
      const doc = await settingsRef.get();
      
      if (doc.exists) {
        const data = doc.data();
        return data.settings || {};
      }
      
      return {};
    } catch (error) {
      console.error('Error getting user settings:', error);
      throw error;
    }
  }

  // Clear all user data
  async function clearAllData() {
    try {
      const db = getDb();
      const batch = db.batch();
      
      // Delete all symbols
      const symbolsSnapshot = await getUserCollection(COLLECTIONS.SYMBOLS).get();
      symbolsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Delete all trades
      const tradesSnapshot = await getUserCollection(COLLECTIONS.TRADES).get();
      tradesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Clear user settings
      const settingsRef = db.collection('users').doc(USER_ID);
      batch.set(settingsRef, {
        settings: {
          selectedSymbolId: null,
          activeView: "dashboard",
          activeStrategy: "fixed",
          clearedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  // Simple initialization - no auth needed
  async function init() {
    try {
      // Just check if Firebase is available
      const db = getDb();
      console.log('Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      throw error;
    }
  }

  app.firebaseService = {
    init,
    saveSymbol,
    getSymbols,
    deleteSymbol,
    saveTrade,
    getTradesForSymbol,
    deleteTrade,
    updateTrade,
    saveUserSettings,
    getUserSettings,
    clearAllData
  };
})(window.BacktestApp);