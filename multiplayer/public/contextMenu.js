// Context menu functionality for selected cards
import { selectedCards, selectedCardIds } from './cardInteractions.js';
import { findCardObjectById, hand, playZone, graveyard, exile, command, library, libraryZone, graveyardZone, exileZone, commandZone } from './zones.js';
import { sendMove } from './gameState.js';
import { showMessage } from './dom.js';
import { debouncedRender } from './gameRenderer.js';
import { addCounterToSelectedCards, setCountersForSelectedCards, removeCounterFromSelectedCards } from './counters.js';

// Context menu state
let cardContextMenu = null;
let contextMenuJustShown = false;

// Show context menu for selected cards
export function showCardContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (selectedCards.length === 0) return;
    
    // Set flag to prevent immediate click events
    contextMenuJustShown = true;
    setTimeout(() => {
        contextMenuJustShown = false;
    }, 100);
    
    hideCardContextMenu();
    
    // Create context menu
    cardContextMenu = document.createElement('div');
    cardContextMenu.className = 'card-context-menu fixed z-50 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 min-w-48';
    cardContextMenu.style.left = `${e.clientX}px`;
    cardContextMenu.style.top = `${e.clientY}px`;
    
    // Header showing selected count
    const header = document.createElement('div');
    header.className = 'px-4 py-2 border-b border-gray-600 text-gray-300 text-sm font-semibold';
    header.textContent = `${selectedCards.length} card${selectedCards.length > 1 ? 's' : ''} selected`;
    cardContextMenu.appendChild(header);
    
    // Add movement options
    addMovementOptions();
    
    // Add separator
    const separator = document.createElement('div');
    separator.className = 'border-t border-gray-600 my-1';
    cardContextMenu.appendChild(separator);
    
    // Add counter options
    addCounterOptions();
    
    // Position menu within viewport
    document.body.appendChild(cardContextMenu);
    const rect = cardContextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        cardContextMenu.style.left = `${e.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        cardContextMenu.style.top = `${e.clientY - rect.height}px`;
    }
}

// Add movement options to context menu
function addMovementOptions() {
    const movementOptions = [
        { text: 'Send to Library (Top)', target: 'library' },
        { text: 'Send to Library (Bottom)', target: 'library-bottom' },
        { text: 'Send to Hand', target: 'hand' },
        { text: 'Send to Graveyard', target: 'graveyard' },
        { text: 'Send to Exile', target: 'exile' },
        { text: 'Send to Command Zone', target: 'command' }
    ];
    
    movementOptions.forEach(option => {
        const button = document.createElement('button');
        button.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
        button.textContent = option.text;
        button.addEventListener('click', () => {
            moveSelectedCardsToZone(option.target);
            hideCardContextMenu();
        });
        cardContextMenu.appendChild(button);
    });
}

// Add counter options to context menu
function addCounterOptions() {
    // Add Counter option
    const addCounterOption = document.createElement('button');
    addCounterOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    addCounterOption.textContent = 'Add Counter';
    addCounterOption.addEventListener('click', () => {
        addCounterToSelectedCards();
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(addCounterOption);
    
    // Set Counters option
    const setCountersOption = document.createElement('button');
    setCountersOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    setCountersOption.textContent = 'Set Counters...';
    setCountersOption.addEventListener('click', () => {
        setCountersForSelectedCards();
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(setCountersOption);
    
    // Remove Counter option (only show if any selected card has counters)
    const hasCounters = selectedCards.some(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        return cardObj && cardObj.counters !== undefined && cardObj.counters !== 0;
    });
    
    if (hasCounters) {
        const removeCounterOption = document.createElement('button');
        removeCounterOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
        removeCounterOption.textContent = 'Remove Counter';
        removeCounterOption.addEventListener('click', () => {
            removeCounterFromSelectedCards();
            hideCardContextMenu();
        });
        cardContextMenu.appendChild(removeCounterOption);
    }
}

// Hide context menu
export function hideCardContextMenu() {
    if (cardContextMenu) {
        cardContextMenu.remove();
        cardContextMenu = null;
    }
    contextMenuJustShown = false;
}

// Move selected cards to specified zone
function moveSelectedCardsToZone(targetZone) {
    if (selectedCards.length === 0) return;
    
    // Get the card IDs and their source zones
    const cardsToMove = selectedCards.map(cardEl => {
        const cardId = cardEl.dataset.id;
        let sourceZone = null;
        let cardObj = null;
        
        // Determine source zone by checking which array contains the card
        if (hand.find(c => c.id === cardId)) {
            sourceZone = 'hand';
            cardObj = hand.find(c => c.id === cardId);
        } else if (playZone.find(c => c.id === cardId)) {
            sourceZone = 'play';
            cardObj = playZone.find(c => c.id === cardId);
        } else if (graveyard.find(c => c.id === cardId)) {
            sourceZone = 'graveyard';
            cardObj = graveyard.find(c => c.id === cardId);
        } else if (exile.find(c => c.id === cardId)) {
            sourceZone = 'exile';
            cardObj = exile.find(c => c.id === cardId);
        } else if (command.find(c => c.id === cardId)) {
            sourceZone = 'command';
            cardObj = command.find(c => c.id === cardId);
        } else if (library.find(c => c.id === cardId)) {
            sourceZone = 'library';
            cardObj = library.find(c => c.id === cardId);
        }
        
        return { cardId, sourceZone, cardObj };
    });
    
    const validCards = cardsToMove.filter(item => item.sourceZone && item.cardObj);
    
    // Remove all cards from their source zones first
    validCards.forEach(({ cardId, sourceZone }) => {
        removeCardFromSourceZone(cardId, sourceZone);
    });
    
    // Filter out placeholder cards and count them
    let placeholderCardsRemoved = 0;
    const validCardsToMove = validCards.filter(({ cardObj, sourceZone }) => {
        if (sourceZone === 'play' && targetZone !== 'play' && cardObj.isPlaceholder) {
            placeholderCardsRemoved++;
            return false;
        }
        return true;
    });
    
    // Add all valid cards to the target zone
    validCardsToMove.forEach(({ cardObj, sourceZone }) => {
        // Reset properties when moving from battlefield
        if (sourceZone === 'play' && targetZone !== 'play') {
            cardObj.rotation = 0;
            if (cardObj.counters) {
                delete cardObj.counters;
            }
            cardObj.faceShown = 'front';
        }
        
        addCardToTargetZone(cardObj, targetZone);
    });
    
    // Update zones and UI
    updateCardZoneDisplays();
    clearSelection();
    sendMove();
    debouncedRender();
    
    // Show confirmation message
    showConfirmationMessage(validCardsToMove.length, placeholderCardsRemoved, targetZone);
}

// Helper function to remove card from source zone
function removeCardFromSourceZone(cardId, sourceZone) {
    let index;
    switch (sourceZone) {
        case 'hand':
            index = hand.findIndex(c => c.id === cardId);
            if (index > -1) hand.splice(index, 1);
            break;
        case 'play':
            index = playZone.findIndex(c => c.id === cardId);
            if (index > -1) playZone.splice(index, 1);
            break;
        case 'graveyard':
            index = graveyard.findIndex(c => c.id === cardId);
            if (index > -1) graveyard.splice(index, 1);
            break;
        case 'exile':
            index = exile.findIndex(c => c.id === cardId);
            if (index > -1) exile.splice(index, 1);
            break;
        case 'command':
            index = command.findIndex(c => c.id === cardId);
            if (index > -1) command.splice(index, 1);
            break;
        case 'library':
            index = library.findIndex(c => c.id === cardId);
            if (index > -1) library.splice(index, 1);
            break;
    }
}

// Helper function to add card to target zone
function addCardToTargetZone(cardObj, targetZone) {
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
    } else if (targetZone === 'library-bottom') {
        library.unshift(cardObj);
    } else if (targetZone === 'graveyard') {
        graveyard.push(cardObj);
    } else if (targetZone === 'exile') {
        exile.push(cardObj);
    } else if (targetZone === 'command') {
        command.push(cardObj);
    }
}

// Helper function to update CardZone displays
function updateCardZoneDisplays() {
    if (libraryZone) libraryZone.updateCards(library);
    if (graveyardZone) graveyardZone.updateCards(graveyard);
    if (exileZone) exileZone.updateCards(exile);
    if (commandZone) commandZone.updateCards(command);
}

// Helper function to clear selection
function clearSelection() {
    selectedCards.forEach(c => c.classList.remove('selected-card'));
    selectedCards.length = 0;
    selectedCardIds.length = 0;
}

// Helper function to show confirmation message
function showConfirmationMessage(validCardCount, placeholderCardsRemoved, targetZone) {
    let message = '';
    
    if (validCardCount > 0) {
        const zoneName = targetZone === 'hand' ? 'hand' : 
                         targetZone === 'library' ? 'top of library' :
                         targetZone === 'library-bottom' ? 'bottom of library' :
                         targetZone === 'graveyard' ? 'graveyard' :
                         targetZone === 'exile' ? 'exile' :
                         targetZone === 'command' ? 'command zone' :
                         targetZone === 'play' ? 'battlefield' : targetZone;
        message = `Moved ${validCardCount} card${validCardCount > 1 ? 's' : ''} to ${zoneName}`;
    }
    
    if (placeholderCardsRemoved > 0) {
        const placeholderMessage = `Removed ${placeholderCardsRemoved} placeholder card${placeholderCardsRemoved > 1 ? 's' : ''}`;
        message = message ? `${message}. ${placeholderMessage}` : placeholderMessage;
    }
    
    if (message) {
        showMessage(message);
    }
}

// Setup context menu event listeners
export function setupContextMenuListeners() {
    document.addEventListener('contextmenu', (e) => {
        // Only show context menu if we have selected cards and right-clicking in a valid area
        if (selectedCards.length > 0 && (e.target.closest('.play-zone') || e.target.closest('#hand-zone') || e.target.closest('.card'))) {
            showCardContextMenu(e);
        }
    });
}
