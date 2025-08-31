// Socket.IO event handlers
import { 
    setRoom, setPlayerId, setGameState, setActivePlayZonePlayerId, setRejoinState,
    gameState, playerId, activePlayZonePlayerId, isRejoinState, loadAllCardImages
} from './gameState.js';
import { 
    hand, library, graveyard, exile, command, playZone, currentLife,
    shuffledLibraryCache, libraryZone, graveyardZone, exileZone, commandZone,
    updateCascadedHandCardsInAreaCount
} from './zones.js';
import { joinUI, gameUI, showMessage } from './dom.js';
import { debouncedRender } from './gameRenderer.js';

export function setupSocketHandlers(socket) {
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    // Handle successful join
    socket.on('joinSuccess', (data) => {
        console.log('Join successful:', data);
        setRoom(data.roomName);
        setPlayerId(data.playerId);
        
        // Debug: Check if state was set properly
        import('./gameState.js').then(state => {
            console.log('After setPlayerId, current values:', {
                playerId: state.playerId,
                room: state.room
            });
        });
        
        showMessage(`Welcome to Vizzerdrix! Joined room: ${data.roomName}`);
    });

    // Handle successful rejoin
    socket.on('rejoinSuccess', (data) => {
        console.log('Rejoin successful:', data);
        setRoom(data.roomName);
        setPlayerId(data.playerId);
        
        // Clear any cached shuffled libraries
        if (typeof shuffledLibraryCache !== 'undefined') {
            shuffledLibraryCache.clear();
        }
        
        // Reset card zones to force reinitialization with fresh state
        libraryZone = null;
        graveyardZone = null;
        exileZone = null;
        commandZone = null;
        
        console.log('Cleared all local state for rejoin');
        showMessage(`Welcome back to Vizzerdrix! Rejoined room: ${data.roomName}`);
    });

    // Handle join/rejoin errors
    socket.on('joinError', (error) => {
        console.error('Join error:', error);
        showMessage(`Error joining game: ${error.message}`);
    });

    socket.on('rejoinError', (error) => {
        console.error('Rejoin error:', error);
        setRejoinState(false);
        showMessage(`Error rejoining game: ${error.message}. You may need to create a new game.`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        if (gameState && playerId) {
            showMessage(`Disconnected from server: ${reason}. Attempting to reconnect...`);
        }
    });

    socket.on('state', async (state) => {
        console.log('RAW STATE RECEIVED:', new Date().toISOString(), {
            currentTurn: state.currentTurn,
            turnOrderSet: state.turnOrderSet,
            turnOrder: state.turnOrder,
            isRejoin: isRejoinState,
            playersInState: Object.keys(state.players || {}),
            currentPlayerId: playerId
        });
        
        // Check if state has actually changed
        const stateChanged = !gameState || JSON.stringify(gameState) !== JSON.stringify(state);
        
        // Check for turn order changes before updating gameState
        const turnOrderChanged = !gameState || 
            gameState.currentTurn !== state.currentTurn ||
            gameState.turnOrderSet !== state.turnOrderSet ||
            JSON.stringify(gameState.turnOrder) !== JSON.stringify(state.turnOrder);
        
        console.log('Received state update:', {
            turnOrderSet: state.turnOrderSet,
            turnOrder: state.turnOrder,
            currentTurn: state.currentTurn,
            stateChanged,
            turnOrderChanged,
            isRejoin: isRejoinState,
            timestamp: new Date().toISOString()
        });
        
        // If this is a rejoin, force a complete state sync from server
        if (isRejoinState && state.players[playerId]) {
            console.log('Rejoin detected - forcing complete state sync from server');
            const serverPlayer = state.players[playerId];
            
            // Completely replace local state with server state (no merging)
            hand.length = 0;
            hand.push(...(serverPlayer.hand || []));
            
            library.length = 0;
            library.push(...(serverPlayer.library || []));
            
            graveyard.length = 0;
            graveyard.push(...(serverPlayer.graveyard || []));
            
            exile.length = 0;
            exile.push(...(serverPlayer.exile || []));
            
            command.length = 0;
            command.push(...(serverPlayer.command || []));
            
            // Also sync the play zone for the current player
            if (state.playZones[playerId]) {
                playZone.length = 0;
                playZone.push(...state.playZones[playerId]);
            } else {
                playZone.length = 0;
            }
            
            // Update life total from server
            if (serverPlayer.life !== undefined) {
                currentLife = serverPlayer.life;
            }
            
            console.log('State sync complete. Local arrays updated:', {
                handCount: hand.length,
                libraryCount: library.length,
                graveyardCount: graveyard.length,
                exileCount: exile.length,
                commandCount: command.length,
                playZoneCount: playZone.length,
                life: currentLife
            });
            
            // Clear the rejoin flag after successful sync
            setRejoinState(false);
            console.log('Rejoin state reset after successful sync');
        }

        setGameState(state);
        
        if (!activePlayZonePlayerId || !gameState.players[activePlayZonePlayerId]) {
            console.log(`Setting activePlayZonePlayerId from ${activePlayZonePlayerId} to ${playerId}`);
            setActivePlayZonePlayerId(playerId);
        }
        
        joinUI.style.display = 'none';
        gameUI.style.display = '';
        
        // Load Scryfall images for all cards
        await loadAllCardImages(state);
        
        // Force render for now (can optimize later)
        console.log('Forcing render for debugging');
        debouncedRender();
        updateCascadedHandCardsInAreaCount();
    });

    return socket;
}
