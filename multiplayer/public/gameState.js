import { CLIENT_ACTION_TIMEOUT } from './constants.js';
import { showMessage } from './dom.js';
import ScryfallCache from './scryfallCache.js';

// Game state variables
export let socket = null;
export let room = null;
export let playerId = null;
export let gameState = null;
export let activePlayZonePlayerId = null;
export let isRejoinState = false;

// State tracking for optimistic updates
export let lastClientAction = null;
export let clientActionTimeout = null;

// Initialize socket connection
export function initializeSocket() {
    socket = io();
    return socket;
}

// Setters for state variables
export function setRoom(newRoom) {
    room = newRoom;
}

export function setPlayerId(newPlayerId) {
    playerId = newPlayerId;
}

export function setGameState(newGameState) {
    gameState = newGameState;
}

export function setActivePlayZonePlayerId(newPlayerId) {
    activePlayZonePlayerId = newPlayerId;
}

export function setRejoinState(isRejoin) {
    isRejoinState = isRejoin;
}

// Mark a client action to preserve optimistic updates
export function markClientAction(action, cardId = null) {
    lastClientAction = { action, cardId, timestamp: Date.now() };
    
    // Clear the action after specified timeout to allow server authority
    if (clientActionTimeout) {
        clearTimeout(clientActionTimeout);
    }
    clientActionTimeout = setTimeout(() => {
        lastClientAction = null;
    }, CLIENT_ACTION_TIMEOUT);
}

// Function to attempt rejoining a game
export function attemptRejoin(roomName, displayName) {
    if (!roomName || !displayName) {
        showMessage('Please enter both room name and display name to rejoin.');
        return;
    }
    
    console.log('Attempting to rejoin room:', roomName, 'as:', displayName);
    
    // Set rejoin flag before emitting
    setRejoinState(true);
    
    socket.emit('rejoin', {
        roomName: roomName.trim(),
        displayName: displayName.trim()
    });
}

// Load Scryfall images for all cards in the game state
export async function loadAllCardImages(gameState) {
    const allCardNames = new Set();
    
    // Collect cards from all players' zones
    Object.values(gameState.players).forEach(player => {
        // Decklist (for newly joining players or unused cards)
        if (player.decklist && Array.isArray(player.decklist)) {
            player.decklist.forEach(cardName => {
                if (typeof cardName === 'string') {
                    allCardNames.add(cardName);
                } else if (cardName && cardName.name) {
                    allCardNames.add(cardName.name);
                }
            });
        }
        
        // Hand cards
        if (player.hand && Array.isArray(player.hand)) {
            player.hand.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
        
        // Library cards  
        if (player.library && Array.isArray(player.library)) {
            player.library.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
        
        // Graveyard cards
        if (player.graveyard && Array.isArray(player.graveyard)) {
            player.graveyard.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
        
        // Exile cards
        if (player.exile && Array.isArray(player.exile)) {
            player.exile.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
        
        // Command cards
        if (player.command && Array.isArray(player.command)) {
            player.command.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
    });
    
    // Collect cards from all play zones
    if (gameState.playZones) {
        Object.values(gameState.playZones).forEach(playZoneCards => {
            if (Array.isArray(playZoneCards)) {
                playZoneCards.forEach(cardData => {
                    if (cardData && cardData.name) {
                        allCardNames.add(cardData.name);
                    }
                });
            }
        });
    }
    
    if (allCardNames.size > 0) {
        console.log(`Loading images for ${allCardNames.size} unique cards from all zones`);
        
        // Import loading functions
        const { showLoadingIndicator, hideLoadingIndicator, updateLoadingProgress } = await import('./dom.js');
        
        // Show loading indicator
        showLoadingIndicator('Loading card images...', `0 of ${allCardNames.size} cards loaded`);
        
        try {
            // Load cards with progress tracking
            const cardNames = Array.from(allCardNames);
            let loadedCount = 0;
            
            // Load cards in batches to show progress
            const batchSize = 10;
            for (let i = 0; i < cardNames.length; i += batchSize) {
                const batch = cardNames.slice(i, i + batchSize);
                await ScryfallCache.load(batch);
                loadedCount += batch.length;
                updateLoadingProgress(loadedCount, cardNames.length, 'card images');
            }
            
            console.log('Finished loading card images');
        } catch (error) {
            console.error('Error loading card images:', error);
        } finally {
            // Hide loading indicator
            hideLoadingIndicator();
        }
    }
}

// Send move to server with debouncing
let sendMoveTimeout = null;

export function sendMove() {
    // Import zones to avoid circular dependency
    import('./zones.js').then(zones => {
        if (!playerId || !gameState) return;
        socket.emit('move', {
            hand: zones.hand,
            library: zones.library,
            graveyard: zones.graveyard,
            exile: zones.exile,
            command: zones.command,
            playZone: zones.playZone,
            life: zones.currentLife
        });
    });
}

export function debouncedSendMove() {
    if (sendMoveTimeout) {
        clearTimeout(sendMoveTimeout);
    }
    sendMoveTimeout = setTimeout(sendMove, 50); // 50ms debounce
}
