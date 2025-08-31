// DOM event listeners setup
import { 
    joinBtn, rejoinBtn, roomNameInput, displayNameInput, decklistInput,
    closeModalBtn, optionsBtn, optionsModal, resetBtnModal, pickTurnOrderBtn, endTurnBtn,
    createPlaceholderBtn, placeholderModal, placeholderTextInput, 
    confirmPlaceholderBtn, cancelPlaceholderBtn,
    magnifyToggleBtn, magnifySizeSlider,
    increaseSizeBtn, decreaseSizeBtn, increaseLifeBtn, decreaseLifeBtn
} from './dom.js';
import { socket, attemptRejoin } from './gameState.js';
import { parseDecklistText } from './decklistParser.js';
import { 
    increaseCardSize, decreaseCardSize, increaseLife, decreaseLife,
    createPlaceholderCard, resetAllCards
} from './zones.js';
import { 
    setMagnifyEnabled, setMagnifySize, isMagnifyEnabled, 
    magnifyPreviewWidth, magnifyPreviewHeight
} from './gameRenderer.js';
import { setupGlobalMouseListeners, setupKeyboardListeners } from './cardInteractions.js';
import { setupContextMenuListeners } from './contextMenu.js';

// Setup all DOM event listeners
export function setupEventListeners() {
    setupJoinListeners();
    setupModalListeners();
    setupPlaceholderListeners();
    setupGameControlListeners();
    setupMagnifyListeners();
    setupCardSizeListeners();
    setupLifeListeners();
    setupGlobalListeners();
}

// Join/rejoin button listeners
function setupJoinListeners() {
    joinBtn.addEventListener('click', () => {
        try {
            const roomName = roomNameInput.value.trim();
            const displayName = displayNameInput.value.trim();
            const decklistRaw = decklistInput.value.trim();
            
            if (!roomName || !displayName) {
                import('./dom.js').then(({ showMessage }) => {
                    showMessage('Please enter both room name and display name.');
                });
                return;
            }
            
            // Parse decklist with proper quantity and commander handling
            const { decklist, commanders } = parseDecklistText(decklistRaw);
            
            // Debug logging
            console.log('Raw decklist input:', decklistRaw);
            console.log('Parsed result:', { 
                decklistCount: decklist.length, 
                commandersCount: commanders.length,
                sampleDecklist: decklist.slice(0, 5),
                commanders: commanders
            });
            
            if (decklist.length === 0 && commanders.length === 0) {
                import('./dom.js').then(({ showMessage }) => {
                    showMessage('Please enter at least one card in your decklist.');
                });
                return;
            }
            
            // Save game info for potential future rejoins
            localStorage.setItem('vizzerdrix-game-info', JSON.stringify({
                roomName,
                displayName,
                timestamp: Date.now()
            }));
            
            console.log('Joining room:', roomName, 'as:', displayName);
            console.log('Sending to server:', { roomName, displayName, decklist, commanders });
            
            socket.emit('join', { roomName, displayName, decklist, commanders });
            
            import('./dom.js').then(({ showMessage }) => {
                showMessage('Joining Vizzerdrix game...');
            });
        } catch (error) {
            console.error('Error in join handler:', error);
            import('./dom.js').then(({ showMessage }) => {
                showMessage('Error processing decklist. Please check the format.');
            });
        }
    });

    rejoinBtn.addEventListener('click', () => {
        const roomName = roomNameInput.value.trim();
        const displayName = displayNameInput.value.trim();
        attemptRejoin(roomName, displayName);
    });
}

// Modal button listeners
function setupModalListeners() {
    closeModalBtn.addEventListener('click', () => {
        import('./dom.js').then(({ messageModal }) => {
            messageModal.classList.add('hidden');
        });
    });

    optionsBtn.addEventListener('click', () => {
        optionsModal.classList.remove('hidden');
    });

    document.getElementById('close-options-btn').addEventListener('click', () => {
        optionsModal.classList.add('hidden');
    });

    resetBtnModal.addEventListener('click', () => {
        resetAllCards();
        optionsModal.classList.add('hidden');
    });
}

// Placeholder card listeners
function setupPlaceholderListeners() {
    createPlaceholderBtn.addEventListener('click', () => {
        optionsModal.classList.add('hidden');
        placeholderModal.classList.remove('hidden');
        placeholderTextInput.focus();
    });

    confirmPlaceholderBtn.addEventListener('click', () => {
        const text = placeholderTextInput.value.trim();
        if (text) {
            createPlaceholderCard(text);
            placeholderModal.classList.add('hidden');
            placeholderTextInput.value = '';
        }
    });

    cancelPlaceholderBtn.addEventListener('click', () => {
        placeholderModal.classList.add('hidden');
        placeholderTextInput.value = '';
    });

    // Allow Enter key to confirm placeholder creation
    placeholderTextInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const text = placeholderTextInput.value.trim();
            if (text) {
                createPlaceholderCard(text);
                placeholderModal.classList.add('hidden');
                placeholderTextInput.value = '';
            }
        }
    });
}

// Game control listeners
function setupGameControlListeners() {
    pickTurnOrderBtn.addEventListener('click', () => {
        console.log('Sending pickTurnOrder event');
        socket.emit('pickTurnOrder');
        import('./dom.js').then(({ showMessage }) => {
            showMessage("Picking random turn order...");
        });
        optionsModal.classList.add('hidden');
    });

    endTurnBtn.addEventListener('click', () => {
        console.log('End turn button clicked - preventing multiple clicks');
        // Prevent multiple rapid clicks
        endTurnBtn.disabled = true;
        setTimeout(() => {
            endTurnBtn.disabled = false;
        }, 1000);
        
        socket.emit('endTurn');
    });
}

// Magnify control listeners
function setupMagnifyListeners() {
    magnifyToggleBtn.addEventListener('click', () => {
        setMagnifyEnabled(!isMagnifyEnabled);
    });

    magnifySizeSlider.addEventListener('input', (e) => {
        const width = parseInt(e.target.value);
        const height = Math.round(width * (107 / 80)); // Standard Magic card ratio
        setMagnifySize(width, height);
    });

    magnifySizeSlider.addEventListener('change', (e) => {
        // Update the global variable that cardFactory.js will use
        window.magnifyPreviewSize = {
            width: magnifyPreviewWidth,
            height: magnifyPreviewHeight
        };
    });
}

// Card size control listeners
function setupCardSizeListeners() {
    increaseSizeBtn.addEventListener('click', increaseCardSize);
    decreaseSizeBtn.addEventListener('click', decreaseCardSize);
}

// Life tracking listeners
function setupLifeListeners() {
    increaseLifeBtn.addEventListener('click', increaseLife);
    decreaseLifeBtn.addEventListener('click', decreaseLife);
}

// Global event listeners (mouse, keyboard, context menu)
function setupGlobalListeners() {
    setupGlobalMouseListeners();
    setupKeyboardListeners();
    setupContextMenuListeners();
}
