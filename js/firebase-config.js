// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCbk9ZoE0oFA62P7ZkIGwT8gHWONrj54-w",
  authDomain: "mybt-10ac9.firebaseapp.com",
  projectId: "mybt-10ac9",
  storageBucket: "mybt-10ac9.firebasestorage.app",
  messagingSenderId: "14394910549",
  appId: "1:14394910549:web:359fc21c0bf457833031dc"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence');
    }
  });

window.BacktestApp = window.BacktestApp || {};
window.BacktestApp.firebase = {
  db
};