// Main client entry point - imports and coordinates all modules
import { initializeSocket } from './gameState.js';
import { initializeCardZones } from './zones.js';
import { setupEventListeners } from './eventHandlers.js';
import { updateMagnifyStatusUI } from './gameRenderer.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Vizzerdrix client...');
    
    // Initialize socket connection
    const socket = initializeSocket();
    
    // Setup socket event handlers
    const { setupSocketHandlers } = await import('./socketHandlers.js');
    setupSocketHandlers(socket);
    
    // Setup DOM event listeners
    setupEventListeners();
    
    // Initialize card zones
    initializeCardZones();
    
    // Initialize UI state
    updateMagnifyStatusUI();
    
    // Initialize magnify size slider and global variable
    window.magnifyPreviewSize = {
        width: 320,
        height: Math.round(320 * (107 / 80))
    };
    
    console.log('Vizzerdrix client initialized successfully');
});

// Export main functions for debugging/console access
window.VizzerdrixDebug = {
    showMessage: () => import('./dom.js').then(m => m.showMessage),
    attemptRejoin: () => import('./gameState.js').then(m => m.attemptRejoin),
    parseDecklistText: () => import('./decklistParser.js').then(m => m.parseDecklistText),
    testParser: async () => {
        const { parseDecklistText } = await import('./decklistParser.js');
        const testInput = `4 Lightning Bolt
2 Sol Ring
1 Black Lotus

Thrasios, Triton Hero`;
        const result = parseDecklistText(testInput);
        console.log('Test result:', result);
        return result;
    }
};
