// Card interaction handling (click, drag, drop, selection)
import { 
    hand, playZone, graveyard, exile, command, library, currentCardWidth,
    findCardObjectById, updateCascadedHandCardsInAreaCount
} from './zones.js';
import { 
    playerId, activePlayZonePlayerId, markClientAction, sendMove, debouncedSendMove
} from './gameState.js';
import { checkIntersection, handZoneEl } from './dom.js';
import { CASCADE_CONFIG, DEBOUNCE_TIMES } from './constants.js';
import { debouncedRender } from './gameRenderer.js';
import { hideCardContextMenu } from './contextMenu.js';

// Selection state
export let selectedCards = [];
export let selectedCardIds = [];
export let isSelecting = false;
export let selectionBox = null;
export let startX = 0;
export let startY = 0;
export let justSelectedByDrag = false;

// Tap/untap debouncing
let tapUntapDebounceTimeout = null;

// Card interaction callbacks for the cardFactory
export function handleCardClick(e, card, cardEl, location) {
    e.stopPropagation();
    if (location === 'play' && activePlayZonePlayerId !== playerId) return;
    
    const cardId = cardEl.dataset.id;
    const isSelected = selectedCardIds.includes(cardId);
    
    if (!e.ctrlKey && !e.metaKey) {
        selectedCards.forEach(c => c.classList.remove('selected-card'));
        selectedCards.length = 0;
        selectedCardIds.length = 0;
    }
    
    if (isSelected) {
        selectedCardIds = selectedCardIds.filter(id => id !== cardId);
        const index = selectedCards.indexOf(cardEl);
        if (index > -1) selectedCards.splice(index, 1);
        cardEl.classList.remove('selected-card');
    } else {
        if (!selectedCardIds.includes(cardId)) {
            selectedCardIds.push(cardId);
            selectedCards.push(cardEl);
        }
        cardEl.classList.add('selected-card');
    }
}

export function handleCardDoubleClick(e, card, location) {
    e.stopPropagation();
    console.log('Double click detected:', { cardId: card.id, cardName: card.name, location });
    
    const cardId = card.id;
    if (location === 'play') {
        // Double-click on play zone cards to tap/untap them
        const cardEl = e.target.closest('.card');
        if (cardEl && cardEl.dataset.id === cardId) {
            tapUntapCards([cardEl]);
        }
        return;
    } else if (location === 'hand') {
        console.log('Processing hand card double-click for card:', cardId);
        
        const cardIndex = hand.findIndex(c => c.id === cardId);
        if (cardIndex > -1) {
            markClientAction('handToPlay', cardId);
            
            const cardObj = hand.splice(cardIndex, 1)[0];
            
            const cascadeOffset = CASCADE_CONFIG.OFFSET;
            const initialX = CASCADE_CONFIG.INITIAL_X;
            const initialY = CASCADE_CONFIG.INITIAL_Y;
            const maxCardsPerRow = CASCADE_CONFIG.MAX_CARDS_PER_ROW;
            
            // Get current cascade count
            let cascadedCount = 0;
            import('./zones.js').then(({ cascadedHandCardsInAreaCount }) => {
                cascadedCount = cascadedHandCardsInAreaCount;
            });
            
            const row = Math.floor(cascadedCount / maxCardsPerRow);
            const col = cascadedCount % maxCardsPerRow;
            const x = initialX + (col * cascadeOffset);
            const y = initialY + (row * cascadeOffset);
            
            const playCard = { ...cardObj, x, y, rotation: 0, fromHandCascade: true };
            playZone.push(playCard);
            
            updateCascadedHandCardsInAreaCount();
            debouncedRender();
            sendMove();
        }
    }
}

export function handleCardDragStart(e, card, location) {
    const sourceZone = location;
    if (selectedCardIds.length > 1 && selectedCardIds.includes(card.id)) {
        const groupData = {
            cardIds: selectedCardIds,
            sourceZone: sourceZone
        };
        e.dataTransfer.setData('application/json', JSON.stringify(groupData));
    } else {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.setData('sourceZone', sourceZone);
    }
}

// Counter click handler
export function handleCounterClick(e, card, isDecrement) {
    e.preventDefault();
    e.stopPropagation();
    
    const cardObj = findCardObjectById(card.id);
    if (!cardObj) return;
    
    if (isDecrement) {
        // Decrement counter (Shift+click)
        if (cardObj.counters !== undefined && cardObj.counters !== 0) {
            cardObj.counters -= 1;
            if (cardObj.counters === 0) {
                delete cardObj.counters;
            }
        }
    } else {
        // Increment counter (normal click)
        if (typeof cardObj.counters !== 'number') {
            cardObj.counters = 0;
        }
        cardObj.counters += 1;
    }
    
    sendMove();
    debouncedRender();
}

// Card movement functions
export function handleCardMove(cardId, sourceZone, targetZone) {
    let cardObj = null;
    
    // Find and remove card from source zone
    if (sourceZone === 'hand') {
        const index = hand.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = hand.splice(index, 1)[0];
    } else if (sourceZone === 'play') {
        const index = playZone.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = playZone.splice(index, 1)[0];
    } else if (sourceZone === 'library') {
        const index = library.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = library.splice(index, 1)[0];
    } else if (sourceZone === 'graveyard') {
        const index = graveyard.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = graveyard.splice(index, 1)[0];
    } else if (sourceZone === 'exile') {
        const index = exile.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = exile.splice(index, 1)[0];
    } else if (sourceZone === 'command') {
        const index = command.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = command.splice(index, 1)[0];
    }
    
    if (!cardObj) return;
    
    // If it's a placeholder card being moved out of play zone, remove it entirely
    if (sourceZone === 'play' && targetZone !== 'play' && cardObj.isPlaceholder) {
        sendMove();
        selectedCardIds.length = 0;
        debouncedRender();
        return;
    }
    
    // Reset properties when moving from battlefield to other zones
    if (sourceZone === 'play' && targetZone !== 'play') {
        cardObj.rotation = 0;
        if (cardObj.counters) {
            delete cardObj.counters;
        }
        cardObj.faceShown = 'front';
    }
    
    // Add to target zone
    if (targetZone === 'hand') {
        hand.push(cardObj);
    } else if (targetZone === 'play') {
        if (cardObj.x === undefined || cardObj.y === undefined) {
            cardObj.x = 50;
            cardObj.y = 50;
        }
        playZone.push(cardObj);
    } else if (targetZone === 'library') {
        library.push(cardObj);
    } else if (targetZone === 'graveyard') {
        graveyard.push(cardObj);
    } else if (targetZone === 'exile') {
        exile.push(cardObj);
    } else if (targetZone === 'command') {
        command.push(cardObj);
    }
    
    sendMove();
    selectedCardIds.length = 0;
    debouncedRender();
}

export function handleCardGroupMove(cardIds, sourceZone, targetZone) {
    if (!cardIds || cardIds.length === 0) return;
    
    const cardsToMove = [];
    cardIds.forEach(cardId => {
        let cardObj = null;
        
        if (sourceZone === 'hand') {
            const index = hand.findIndex(c => c.id === cardId);
            if (index > -1) cardObj = hand.splice(index, 1)[0];
        } else if (sourceZone === 'play') {
            const index = playZone.findIndex(c => c.id === cardId);
            if (index > -1) cardObj = playZone.splice(index, 1)[0];
        } // ... other zones
        
        if (cardObj) {
            // If it's a placeholder card being moved out of play zone, skip it
            if (sourceZone === 'play' && targetZone !== 'play' && cardObj.isPlaceholder) {
                return;
            }
            
            // Reset properties when moving from battlefield
            if (sourceZone === 'play' && targetZone !== 'play') {
                cardObj.rotation = 0;
                if (cardObj.counters) {
                    delete cardObj.counters;
                }
                cardObj.faceShown = 'front';
            }
            
            cardsToMove.push(cardObj);
        }
    });
    
    // Add all cards to target zone
    cardsToMove.forEach(cardObj => {
        if (targetZone === 'hand') {
            hand.push(cardObj);
        } else if (targetZone === 'play') {
            if (cardObj.x === undefined || cardObj.y === undefined) {
                cardObj.x = 50;
                cardObj.y = 50;
            }
            playZone.push(cardObj);
        } else if (targetZone === 'library') {
            library.push(cardObj);
        } else if (targetZone === 'graveyard') {
            graveyard.push(cardObj);
        } else if (targetZone === 'exile') {
            exile.push(cardObj);
        } else if (targetZone === 'command') {
            command.push(cardObj);
        }
    });
    
    sendMove();
    selectedCardIds.length = 0;
    debouncedRender();
}

// Tap/untap functionality
export function tapUntapCards(cardElements) {
    if (!cardElements || cardElements.length === 0) return false;
    
    if (tapUntapDebounceTimeout) {
        clearTimeout(tapUntapDebounceTimeout);
    }
    
    tapUntapDebounceTimeout = setTimeout(() => {
        const playZoneCards = cardElements.filter(cardEl => cardEl.closest('.play-zone'));
        if (playZoneCards.length === 0) return false;
        
        // If any selected card is untapped, tap all selected. Otherwise, untap all.
        const shouldTap = playZoneCards.some(cardEl => {
            const cardId = cardEl.dataset.id;
            const cardData = playZone.find(c => c.id === cardId);
            return cardData && (cardData.rotation || 0) === 0;
        });
        const newRotation = shouldTap ? 90 : 0;
        
        // Apply state changes and visual changes immediately
        playZoneCards.forEach(cardEl => {
            const cardId = cardEl.dataset.id;
            const cardIndex = playZone.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                playZone[cardIndex].rotation = newRotation;
                cardEl.style.transform = `rotate(${newRotation}deg)`;
            }
        });
        
        debouncedSendMove();
    }, DEBOUNCE_TIMES.TAP_UNTAP);
    
    return true;
}

// Drop listeners for zones
export function addDropListeners() {
    const activeZone = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
    if (!activeZone) return;

    // Only handle play zone and hand zone - library and discard are handled by CardZone instances
    const dropZones = [activeZone, handZoneEl].filter(zone => zone);
    
    dropZones.forEach(zone => {
        if (zone.dataset.listening) return;
        zone.dataset.listening = true;

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (zone.id.startsWith('play-zone') && activePlayZonePlayerId !== playerId) {
                return;
            }
            zone.classList.add('zone-active');
        });
        
        zone.addEventListener('dragleave', (e) => {
            zone.classList.remove('zone-active');
        });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('zone-active');
            
            if (zone.id.startsWith('play-zone') && activePlayZonePlayerId !== playerId) {
                return;
            }

            const groupDataString = e.dataTransfer.getData('application/json');
            if (groupDataString) {
                const groupData = JSON.parse(groupDataString);
                const targetZone = zone.id.startsWith('play-zone') ? 'play' : 'hand';
                
                if (targetZone === 'play') {
                    // For play zone, set positions for each card
                    groupData.cardIds.forEach((cardId, index) => {
                        const rect = zone.getBoundingClientRect();
                        const cascadeOffset = 15;
                        const x = e.clientX - rect.left - (currentCardWidth / 2) + (index * cascadeOffset);
                        const y = e.clientY - rect.top - ((currentCardWidth * 120/90) / 2) + (index * cascadeOffset);
                        
                        handleCardMove(cardId, groupData.sourceZone, 'play');
                        const movedCard = playZone.find(c => c.id === cardId);
                        if (movedCard) {
                            movedCard.x = x;
                            movedCard.y = y;
                        }
                    });
                } else {
                    handleCardGroupMove(groupData.cardIds, groupData.sourceZone, 'hand');
                }
            } else {
                const cardId = e.dataTransfer.getData('text/plain');
                const sourceZone = e.dataTransfer.getData('sourceZone');
                const targetZone = zone.id.startsWith('play-zone') ? 'play' : 'hand';
                
                if (targetZone === 'play') {
                    const rect = zone.getBoundingClientRect();
                    const x = e.clientX - rect.left - (currentCardWidth / 2);
                    const y = e.clientY - rect.top - ((currentCardWidth * 120/90) / 2);
                    
                    handleCardMove(cardId, sourceZone, 'play');
                    const movedCard = playZone.find(c => c.id === cardId);
                    if (movedCard) {
                        movedCard.x = x;
                        movedCard.y = y;
                    }
                } else {
                    handleCardMove(cardId, sourceZone, 'hand');
                }
            }
            
            selectedCardIds.length = 0;
            debouncedRender();
        });
    });
}

// Utility function to remove a card from its source zone
function removeCardFromSource(cardId, sourceZone) {
    let cardIndex;
    switch (sourceZone) {
        case 'hand':
            cardIndex = hand.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                hand.splice(cardIndex, 1);
            }
            break;
        case 'play':
            cardIndex = playZone.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                playZone.splice(cardIndex, 1);
                updateCascadedHandCardsInAreaCount(); // Update cascade count when removing from play zone
            }
            break;
        case 'graveyard':
            cardIndex = graveyard.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                graveyard.splice(cardIndex, 1);
            }
            break;
        case 'exile':
            cardIndex = exile.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                exile.splice(cardIndex, 1);
            }
            break;
        case 'command':
            cardIndex = command.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                command.splice(cardIndex, 1);
            }
            break;
        case 'library':
            cardIndex = library.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                library.splice(cardIndex, 1);
            }
            break;
    }
}

// Selection listeners
export function addSelectionListeners() {
    const activeZone = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
    if (!activeZone || activePlayZonePlayerId !== playerId) return;

    activeZone.addEventListener('mousedown', (e) => {
        if (e.target === activeZone) {
            isSelecting = true;
            startX = e.clientX;
            startY = e.clientY;
            
            selectedCards.forEach(c => c.classList.remove('selected-card'));
            selectedCards.length = 0;
            selectedCardIds.length = 0;

            selectionBox = document.createElement('div');
            selectionBox.className = 'selection-box';
            selectionBox.style.left = `${e.clientX}px`;
            selectionBox.style.top = `${e.clientY}px`;
            activeZone.appendChild(selectionBox);
        }
    });
}

// Global mouse event listeners for selection
export function setupGlobalMouseListeners() {
    document.addEventListener('mousemove', (e) => {
        if (isSelecting) {
            const currentX = e.clientX;
            const currentY = e.clientY;
            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(startX - currentX);
            const height = Math.abs(startY - currentY);
            
            selectionBox.style.left = `${left}px`;
            selectionBox.style.top = `${top}px`;
            selectionBox.style.width = `${width}px`;
            selectionBox.style.height = `${height}px`;

            const selectionRect = selectionBox.getBoundingClientRect();
            const activeZone = document.getElementById(`play-zone-${playerId}`);
            const allCards = activeZone?.querySelectorAll('.card') || [];
            
            selectedCards.length = 0;
            selectedCardIds.length = 0;
            allCards.forEach(cardEl => {
                const cardRect = cardEl.getBoundingClientRect();
                if (checkIntersection(selectionRect, cardRect)) {
                    const cardId = cardEl.dataset.id;
                    if (!selectedCardIds.includes(cardId)) {
                        selectedCards.push(cardEl);
                        selectedCardIds.push(cardId);
                    }
                    cardEl.classList.add('selected-card');
                } else {
                    cardEl.classList.remove('selected-card');
                }
            });
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isSelecting) {
            isSelecting = false;
            if (selectedCards.length > 0) {
                justSelectedByDrag = true;
            }
            if (selectionBox) {
                selectionBox.remove();
                selectionBox = null;
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (justSelectedByDrag) {
            justSelectedByDrag = false;
            return;
        }
        if (!e.target.closest('.play-zone') && !e.target.closest('#hand-zone')) {
            selectedCards.forEach(c => c.classList.remove('selected-card'));
            selectedCards.length = 0;
            selectedCardIds.length = 0;
        }
        
        // Hide context menu on any click
        hideCardContextMenu();
    });
}

// Keyboard event listeners
export function setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && selectedCards.length > 0) {
            e.preventDefault();
            tapUntapCards(selectedCards);
        } else if (e.code === 'KeyF' && selectedCards.length > 0) {
            e.preventDefault();
            // Flip selected cards
            selectedCards.forEach(cardEl => {
                import('./cardFactory.js').then(module => {
                    const flipped = module.flipCard(cardEl);
                    if (flipped) {
                        const cardId = cardEl.dataset.id;
                        const currentFace = cardEl.dataset.faceShown;
                        
                        // Update card face in appropriate zone
                        [hand, playZone, graveyard, exile, command, library].forEach(zone => {
                            const card = zone.find(c => c.id === cardId);
                            if (card) {
                                card.faceShown = currentFace === 'front' ? 'back' : 'front';
                            }
                        });
                        
                        sendMove();
                    }
                });
            });
        } else if (e.code === 'KeyX' && selectedCards.length > 0) {
            e.preventDefault();
            // Create copies
            import('./zones.js').then(({ createCopiesOfSelectedCards }) => {
                createCopiesOfSelectedCards();
            });
        }
    });
}
