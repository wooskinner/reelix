// config.js
const CONFIG = {
    // 1. Cloudflare Worker Configuration
    // Replace with your actual worker URL
    WORKER_URL: "https://reelix.wooskinner.workers.dev",
    
    // 2. Firebase Configuration
    // Get these from your Firebase Console Settings
    FIREBASE: {
        apiKey: "AIzaSyA...", 
        authDomain: "reelix-app.firebaseapp.com",
        projectId: "reelix-app",
        storageBucket: "reelix-app.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abcdef"
    },

    // 3. TMDB Image Configuration
    IMG: {
        W500: 'https://image.tmdb.org/t/p/w500',
        W342: 'https://image.tmdb.org/t/p/w342',
        ORIGINAL: 'https://image.tmdb.org/t/p/original'
    }
};

export default CONFIG;
