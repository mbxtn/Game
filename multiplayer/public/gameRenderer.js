// Game rendering and UI update logic
import { createCardElement } from './cardFactory.js';
import { 
    gameState, playerId, activePlayZonePlayerId, lastClientAction, isRejoinState
} from './gameState.js';
import { 
    hand, library, graveyard, exile, command, playZone, currentLife, currentCardWidth,
    shuffledLibraryCache, libraryZone, graveyardZone, exileZone, commandZone,
    initializeCardZones, updateCounts
} from './zones.js';
import { 
    playZonesContainer, playerTabsEl, handZoneEl, lifeTotalEl, 
    turnIndicator, currentPlayerNameEl, endTurnBtn, loadHeartSVG,
    magnifyStatusEl, magnifySizeSliderContainer
} from './dom.js';
import { selectedCards, selectedCardIds, addDropListeners, addSelectionListeners } from './cardInteractions.js';
import { DEBOUNCE_TIMES, MAGNIFY_DEFAULTS } from './constants.js';

// Render state
let renderTimeout = null;
let isRendering = false;
export let isMagnifyEnabled = false;
export let magnifyPreviewWidth = MAGNIFY_DEFAULTS.WIDTH;
export let magnifyPreviewHeight = MAGNIFY_DEFAULTS.HEIGHT;

// Debounced render function to prevent excessive re-renders
export function debouncedRender() {
    if (renderTimeout) {
        clearTimeout(renderTimeout);
    }
    renderTimeout = setTimeout(render, DEBOUNCE_TIMES.RENDER);
}

// Main render function
export async function render() {
    console.log('Render called at:', new Date().toISOString());
    
    // Get current state dynamically to ensure we have the latest values
    const { gameState: currentGameState, playerId: currentPlayerId, activePlayZonePlayerId: currentActivePlayZonePlayerId } = await import('./gameState.js');
    
    // Debounce render calls to prevent flickering
    if (renderTimeout) {
        clearTimeout(renderTimeout);
    }
    
    if (isRendering) {
        renderTimeout = setTimeout(render, DEBOUNCE_TIMES.RENDER);
        return;
    }
    
    isRendering = true;
    
    // Load heart SVG if not already loaded
    await loadHeartSVG();
    
    try {
        if (!currentGameState || !currentPlayerId) {
            console.log('Render aborted: missing gameState or playerId', {
                hasGameState: !!currentGameState,
                hasPlayerId: !!currentPlayerId,
                gameState: currentGameState,
                playerId: currentPlayerId
            });
            return;
        }

        console.log('Render proceeding with:', { 
            playerId: currentPlayerId, 
            playerCount: Object.keys(currentGameState.players).length 
        });

        // Use local references to current state for the rest of the function
        const gameState = currentGameState;
        const playerId = currentPlayerId;
        const activePlayZonePlayerId = currentActivePlayZonePlayerId;
        
        // Get current client action state
        const { lastClientAction, isRejoinState } = await import('./gameState.js');

        // Smart merge: preserve recent client changes, use server for everything else
        const serverHand = gameState.players[playerId]?.hand || [];
        const viewedPlayerId = activePlayZonePlayerId || playerId;
        const serverLibrary = gameState.players[viewedPlayerId]?.library || [];
        const serverGraveyard = gameState.players[viewedPlayerId]?.graveyard || [];
        const serverExile = gameState.players[viewedPlayerId]?.exile || [];
        const serverCommand = gameState.players[viewedPlayerId]?.command || [];
        const serverPlayZone = gameState.playZones[viewedPlayerId] || [];
        
        // If we have a recent client action, preserve local state for a short time
        const hasRecentClientAction = lastClientAction && (Date.now() - lastClientAction.timestamp < 1000) && !isRejoinState;
        
        if (hasRecentClientAction && viewedPlayerId === playerId) {
            console.log('Preserving local state due to recent client action:', lastClientAction.action);
            // Keep local state for recent actions, but merge other players' changes
            if (serverPlayZone.length > playZone.length) {
                serverPlayZone.forEach(serverCard => {
                    if (!playZone.find(localCard => localCard.id === serverCard.id)) {
                        playZone.push(serverCard);
                    }
                });
            }
        } else {
            console.log('Using server state as source of truth', { 
                isRejoin: isRejoinState, 
                hasRecentClientAction, 
                viewedPlayerId, 
                playerId,
                serverHandCount: serverHand.length,
                serverLibraryCount: serverLibrary.length,
                serverGraveyardCount: serverGraveyard.length,
                serverExileCount: serverExile.length,
                serverCommandCount: serverCommand.length,
                serverPlayZoneCount: serverPlayZone.length
            });
            
            // Update local arrays
            hand.length = 0;
            hand.push(...serverHand);
            
            // Update life total from server for current player
            if (gameState.players[playerId]?.life !== undefined) {
                const newLife = gameState.players[playerId].life;
                if (newLife !== currentLife) {
                    zones.currentLife = newLife;
                    lifeTotalEl.textContent = newLife;
                }
            }
            
            if (viewedPlayerId === playerId) {
                // Viewing our own zones
                library.length = 0;
                library.push(...serverLibrary);
                
                graveyard.length = 0;
                graveyard.push(...serverGraveyard);
                
                exile.length = 0;
                exile.push(...serverExile);
                
                command.length = 0;
                command.push(...(serverCommand || []));
                
                playZone.length = 0;
                playZone.push(...serverPlayZone);
            } else {
                // Viewing another player's zones - use cached shuffled library
                const cacheKey = `${viewedPlayerId}-${serverLibrary.length}-${JSON.stringify(serverLibrary.slice(0, 3))}`;
                if (!shuffledLibraryCache.has(cacheKey)) {
                    const shuffledCopy = [...serverLibrary];
                    import('./dom.js').then(({ shuffleArray }) => {
                        shuffleArray(shuffledCopy);
                        shuffledLibraryCache.set(cacheKey, shuffledCopy);
                    });
                }
                
                library.length = 0;
                library.push(...(shuffledLibraryCache.get(cacheKey) || serverLibrary));
                
                graveyard.length = 0;
                graveyard.push(...serverGraveyard);
                
                exile.length = 0;
                exile.push(...serverExile);
                
                command.length = 0;
                command.push(...(serverCommand || []));
                
                playZone.length = 0;
                playZone.push(...serverPlayZone);
            }
        }

        // Update CardZone instances
        const allowInteractions = viewedPlayerId === playerId;
        
        // Initialize card zones if they don't exist
        if (!libraryZone || !graveyardZone || !exileZone || !commandZone) {
            console.log('Initializing card zones (missing after rejoin)');
            initializeCardZones();
        }
        
        // Update all zones
        [libraryZone, graveyardZone, exileZone, commandZone].forEach(zone => {
            if (zone) {
                zone.setInteractionEnabled(allowInteractions);
                zone.updateMagnifyEnabled(isMagnifyEnabled);
            }
        });
        
        if (libraryZone) libraryZone.updateCards(library);
        if (graveyardZone) graveyardZone.updateCards(graveyard);
        if (exileZone) exileZone.updateCards(exile);
        if (commandZone) commandZone.updateCards(command);

        // Render hand
        renderHand();

        // Render play zones and tabs
        renderPlayZonesAndTabs();
        
        // Update turn control UI
        renderTurnControls();

        // Re-apply selection
        reapplySelection();

        // Re-add listeners and update counts
        addDropListeners();
        addSelectionListeners();
        updateCounts();
        
    } finally {
        isRendering = false;
    }
}

// Render hand zone
function renderHand() {
    const { handleCardClick, handleCardDoubleClick, handleCardDragStart, handleCounterClick } = import('./cardInteractions.js');
    
    handZoneEl.innerHTML = '';
    hand.forEach(card => {
        handZoneEl.appendChild(createCardElement(card, 'hand', {
            isMagnifyEnabled: isMagnifyEnabled,
            isInteractable: true,
            onCardClick: handleCardClick,
            onCardDblClick: handleCardDoubleClick,
            onCardDragStart: handleCardDragStart,
            onCounterClick: handleCounterClick,
            showBack: card.faceShown === 'back'
        }));
    });
}

// Render play zones and player tabs
function renderPlayZonesAndTabs() {
    const { handleCardClick, handleCardDoubleClick, handleCardDragStart, handleCounterClick } = import('./cardInteractions.js');
    
    playZonesContainer.innerHTML = '';
    playerTabsEl.innerHTML = '';
    
    // Determine player order
    let playerOrder = [];
    if (gameState.turnOrderSet && gameState.turnOrder) {
        playerOrder = gameState.turnOrder;
    } else {
        playerOrder = Object.keys(gameState.players);
    }
    
    playerOrder.forEach(pid => {
        if (!gameState.players[pid]) return;
        
        // Create play zone div
        const playerZoneEl = document.createElement('div');
        playerZoneEl.id = `play-zone-${pid}`;
        playerZoneEl.className = 'play-zone w-full h-full relative';
        if (pid !== activePlayZonePlayerId) {
            playerZoneEl.style.display = 'none';
        }
        
        const playerZoneData = gameState.playZones[pid] || [];
        playerZoneData.forEach(cardData => {
            const isInteractable = (pid === activePlayZonePlayerId && pid === playerId);
            const cardEl = createCardElement(cardData, 'play', {
                isMagnifyEnabled: isMagnifyEnabled,
                isInteractable: isInteractable,
                onCardClick: isInteractable ? handleCardClick : null,
                onCardDblClick: isInteractable ? handleCardDoubleClick : null,
                onCardDragStart: isInteractable ? handleCardDragStart : null,
                onCounterClick: isInteractable ? handleCounterClick : null,
                showBack: cardData.faceShown === 'back'
            });
            cardEl.style.position = 'absolute';
            cardEl.style.left = `${cardData.x}px`;
            cardEl.style.top = `${cardData.y}px`;
            cardEl.style.transform = `rotate(${cardData.rotation || 0}deg)`;
            playerZoneEl.appendChild(cardEl);
        });
        playZonesContainer.appendChild(playerZoneEl);

        // Create player tab
        renderPlayerTab(pid);
    });
}

// Render individual player tab
function renderPlayerTab(pid) {
    const tabEl = document.createElement('button');
    tabEl.className = 'px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2';
    
    const playerName = gameState.players[pid].displayName;
    const isCurrentPlayer = pid === playerId;
    const displayName = isCurrentPlayer ? `${playerName} (you)` : playerName;
    const handCount = gameState.players[pid].hand?.length || 0;
    const lifeTotal = gameState.players[pid].life || 20;
    
    // Create the tab content with name, life (heart icon), and hand count
    tabEl.innerHTML = `
        <span>${displayName}</span>
        <div class="flex items-center gap-2">
            <div class="flex items-center gap-1">
                <img src="heart.svg" alt="♥" class="w-3.5 h-3.5" style="filter: hue-rotate(0deg) saturate(2) brightness(0.8);">
                <span class="text-xs font-bold">${lifeTotal}</span>
            </div>
            <div class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
                    <path d="m608-368 46-166-142-98-46 166 142 98ZM160-207l-33-16q-31-13-42-44.5t3-62.5l72-156v279Zm160 87q-33 0-56.5-24T240-201v-239l107 294q3 7 5 13.5t7 12.5h-39Zm206-5q-31 11-62-3t-42-45L245-662q-11-31 3-61.5t45-41.5l301-110q31-11 61.5 3t41.5 45l178 489q11 31-3 61.5T827-235L526-125Zm-28-75 302-110-179-490-301 110 178 490Zm62-300Z"/>
                </svg>
                <span class="text-xs">${handCount}</span>
            </div>
        </div>
    `;
    
    // Highlight current turn player if turn order is set
    if (gameState.turnOrderSet && gameState.turnOrder && gameState.currentTurn !== undefined && gameState.turnOrder[gameState.currentTurn] === pid) {
        tabEl.classList.add('ring-2', 'ring-yellow-400');
    }
    
    if (pid === activePlayZonePlayerId) {
        tabEl.classList.add('bg-blue-600', 'text-white');
    } else {
        tabEl.classList.add('bg-gray-700', 'hover:bg-gray-600');
    }
    
    tabEl.addEventListener('click', () => {
        import('./gameState.js').then(({ setActivePlayZonePlayerId }) => {
            setActivePlayZonePlayerId(pid);
            render();
        });
    });
    
    playerTabsEl.appendChild(tabEl);
}

// Render turn control UI
function renderTurnControls() {
    console.log('Updating turn control UI:', {
        turnOrderSet: gameState.turnOrderSet,
        turnOrder: gameState.turnOrder,
        currentTurn: gameState.currentTurn
    });
    
    if (gameState.turnOrderSet && gameState.turnOrder && gameState.currentTurn !== undefined) {
        const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurn];
        const currentPlayerName = gameState.players[currentTurnPlayerId]?.displayName || 'Unknown';
        
        turnIndicator.style.display = 'block';
        currentPlayerNameEl.textContent = currentTurnPlayerId === playerId ? 'You' : currentPlayerName;
        
        // Show end turn button only if it's the current player's turn
        if (currentTurnPlayerId === playerId) {
            endTurnBtn.style.display = 'block';
            endTurnBtn.disabled = false;
        } else {
            endTurnBtn.style.display = 'none';
            endTurnBtn.disabled = true;
        }
    } else {
        // No turn order set yet
        turnIndicator.style.display = 'none';
        endTurnBtn.style.display = 'none';
        endTurnBtn.disabled = true;
    }
}

// Re-apply card selection after render
function reapplySelection() {
    import('./cardInteractions.js').then(({ selectedCards, selectedCardIds }) => {
        selectedCards.length = 0;
        const currentActivePlayZoneEl = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
        if (currentActivePlayZoneEl) {
            selectedCardIds.forEach(cardId => {
                const cardEl = currentActivePlayZoneEl.querySelector(`.card[data-id="${cardId}"]`);
                if (cardEl) {
                    cardEl.classList.add('selected-card');
                    selectedCards.push(cardEl);
                }
            });
        }
    });
}

// Magnify controls
export function updateMagnifyStatusUI() {
    if (isMagnifyEnabled) {
        magnifyStatusEl.textContent = 'On';
        magnifyStatusEl.classList.remove('bg-red-600');
        magnifyStatusEl.classList.add('bg-green-600');
        magnifySizeSliderContainer.classList.remove('hidden');
    } else {
        magnifyStatusEl.textContent = 'Off';
        magnifyStatusEl.classList.remove('bg-green-600');
        magnifyStatusEl.classList.add('bg-red-600');
        magnifySizeSliderContainer.classList.add('hidden');
    }
}

export function applyMagnifyEffectToAllCards() {
    // Update CardZone magnify settings
    [libraryZone, graveyardZone, exileZone, commandZone].forEach(zone => {
        if (zone) {
            zone.updateMagnifyEnabled(isMagnifyEnabled);
        }
    });
    render();
}

export function setMagnifyEnabled(enabled) {
    isMagnifyEnabled = enabled;
    updateMagnifyStatusUI();
    applyMagnifyEffectToAllCards();
}

export function setMagnifySize(width, height) {
    magnifyPreviewWidth = width;
    magnifyPreviewHeight = height;
    
    // Update the global variable that cardFactory.js will use
    window.magnifyPreviewSize = {
        width: magnifyPreviewWidth,
        height: magnifyPreviewHeight
    };
}
