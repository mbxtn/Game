// Counter management functionality
import { selectedCards, selectedCardIds } from './cardInteractions.js';
import { findCardObjectById } from './zones.js';
import { sendMove } from './gameState.js';
import { showMessage } from './dom.js';
import { debouncedRender } from './gameRenderer.js';

// Add counter to selected cards
export function addCounterToSelectedCards() {
    if (selectedCards.length === 0) return;
    
    let cardsUpdated = 0;
    selectedCards.forEach(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        
        if (cardObj) {
            // Initialize counters property if it doesn't exist
            if (typeof cardObj.counters !== 'number') {
                cardObj.counters = 0;
            }
            cardObj.counters += 1;
            cardsUpdated++;
        }
    });
    
    if (cardsUpdated > 0) {
        clearSelection();
        sendMove();
        debouncedRender();
        
        showMessage(`Added +1 counter to ${cardsUpdated} card${cardsUpdated > 1 ? 's' : ''}.`);
    }
}

// Remove counter from selected cards
export function removeCounterFromSelectedCards() {
    if (selectedCards.length === 0) return;
    
    let cardsUpdated = 0;
    selectedCards.forEach(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        
        if (cardObj && cardObj.counters !== undefined && cardObj.counters !== 0) {
            cardObj.counters -= 1;
            
            // Remove counters property if it reaches 0
            if (cardObj.counters === 0) {
                delete cardObj.counters;
            }
            cardsUpdated++;
        }
    });
    
    if (cardsUpdated > 0) {
        clearSelection();
        sendMove();
        debouncedRender();
        
        showMessage(`Removed counter from ${cardsUpdated} card${cardsUpdated > 1 ? 's' : ''}.`);
    }
}

// Set counters for selected cards to a specific value
export function setCountersForSelectedCards() {
    if (selectedCards.length === 0) return;
    
    // Get the range of current counter values for context
    const counterValues = selectedCards.map(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        return cardObj && cardObj.counters ? cardObj.counters : 0;
    });
    
    const currentMin = Math.min(...counterValues);
    const currentMax = Math.max(...counterValues);
    const defaultValue = currentMax !== currentMin ? currentMax : (currentMax || 0);
    
    const rangeText = currentMin === currentMax ? `Current: ${currentMax}` : `Range: ${currentMin} to ${currentMax}`;
    const input = prompt(`Set counters for ${selectedCards.length} selected card${selectedCards.length > 1 ? 's' : ''}:\n(${rangeText})\n\nEnter number (negative values allowed, 0 removes counters):`, defaultValue.toString());
    
    if (input === null) return; // User cancelled
    
    const counterValue = parseInt(input);
    if (isNaN(counterValue)) {
        showMessage("Please enter a valid number (negative values allowed, 0 removes counters).");
        return;
    }
    
    let cardsUpdated = 0;
    selectedCards.forEach(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        
        if (cardObj) {
            if (counterValue === 0) {
                // Remove counters property if setting to 0
                if (cardObj.counters) {
                    delete cardObj.counters;
                    cardsUpdated++;
                }
            } else {
                // Set the counter value (positive or negative)
                cardObj.counters = counterValue;
                cardsUpdated++;
            }
        }
    });
    
    if (cardsUpdated > 0) {
        clearSelection();
        sendMove();
        debouncedRender();
        
        // Show feedback message
        if (counterValue === 0) {
            showMessage(`Removed counters from ${cardsUpdated} card${cardsUpdated > 1 ? 's' : ''}.`);
        } else {
            const counterType = counterValue > 0 ? `+${counterValue}` : counterValue.toString();
            showMessage(`Set counters to ${counterType} on ${cardsUpdated} card${cardsUpdated > 1 ? 's' : ''}.`);
        }
    }
}

// Increment counter on a specific card
export function incrementCounter(cardId) {
    const cardObj = findCardObjectById(cardId);
    if (!cardObj) return;
    
    if (typeof cardObj.counters !== 'number') {
        cardObj.counters = 0;
    }
    cardObj.counters += 1;
    
    sendMove();
    debouncedRender();
}

// Decrement counter on a specific card
export function decrementCounter(cardId) {
    const cardObj = findCardObjectById(cardId);
    if (!cardObj) return;
    
    if (cardObj.counters !== undefined && cardObj.counters !== 0) {
        cardObj.counters -= 1;
        if (cardObj.counters === 0) {
            delete cardObj.counters;
        }
        
        sendMove();
        debouncedRender();
    }
}

// Set counter to a specific value for a card
export function setCounter(cardId, value) {
    const cardObj = findCardObjectById(cardId);
    if (!cardObj) return;
    
    if (value === 0) {
        if (cardObj.counters) {
            delete cardObj.counters;
        }
    } else {
        cardObj.counters = value;
    }
    
    sendMove();
    debouncedRender();
}

// Get counter value for a card
export function getCounterValue(cardId) {
    const cardObj = findCardObjectById(cardId);
    return cardObj && cardObj.counters ? cardObj.counters : 0;
}

// Check if a card has counters
export function hasCounters(cardId) {
    const cardObj = findCardObjectById(cardId);
    return cardObj && cardObj.counters !== undefined && cardObj.counters !== 0;
}

// Helper function to clear selection
function clearSelection() {
    selectedCards.forEach(c => c.classList.remove('selected-card'));
    selectedCards.length = 0;
    selectedCardIds.length = 0;
}
