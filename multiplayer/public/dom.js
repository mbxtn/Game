// DOM element references
export const joinBtn = document.getElementById('join-btn');
export const rejoinBtn = document.getElementById('rejoin-btn');
export const roomNameInput = document.getElementById('room-input');
export const displayNameInput = document.getElementById('display-name-input');
export const decklistInput = document.getElementById('decklist-input');
export const joinUI = document.getElementById('join-ui');
export const gameUI = document.getElementById('game-ui');
export const playZonesContainer = document.getElementById('play-zones-container');
export const playerTabsContainer = document.getElementById('player-tabs-container');
export const handZoneEl = document.getElementById('hand-zone');
export const libraryEl = document.getElementById('library');
export const graveyardPileEl = document.getElementById('graveyard-pile');
export const exilePileEl = document.getElementById('exile-pile');
export const commandPileEl = document.getElementById('command-pile');
export const libraryCountEl = document.getElementById('library-count');
export const discardCountEl = document.getElementById('graveyard-count');
export const exileCountEl = document.getElementById('exile-count');
export const commandCountEl = document.getElementById('command-count');
export const messageModal = document.getElementById('message-modal');
export const messageText = document.getElementById('message-text');
export const closeModalBtn = document.getElementById('close-modal-btn');
export const optionsBtn = document.getElementById('options-btn');
export const optionsModal = document.getElementById('options-modal');
export const resetBtnModal = document.getElementById('reset-btn-modal');
export const pickTurnOrderBtn = document.getElementById('pick-turn-order-btn');
export const endTurnBtn = document.getElementById('end-turn-btn');
export const turnIndicator = document.getElementById('turn-indicator');
export const currentPlayerNameEl = document.getElementById('current-player-name');
export const playerTabsEl = document.getElementById('player-tabs');
export const loadingOverlay = document.getElementById('loading-overlay');
export const loadingText = document.getElementById('loading-text');
export const loadingSubtext = document.getElementById('loading-subtext');
export const increaseSizeBtn = document.getElementById('increase-size-btn');
export const decreaseSizeBtn = document.getElementById('decrease-size-btn');
export const createPlaceholderBtn = document.getElementById('create-placeholder-btn');
export const placeholderModal = document.getElementById('placeholder-modal');
export const placeholderTextInput = document.getElementById('placeholder-text-input');
export const confirmPlaceholderBtn = document.getElementById('confirm-placeholder-btn');
export const cancelPlaceholderBtn = document.getElementById('cancel-placeholder-btn');
export const magnifyToggleBtn = document.getElementById('magnify-toggle-btn');
export const magnifyStatusEl = document.getElementById('magnify-status');
export const magnifySizeSliderContainer = document.getElementById('magnify-size-slider-container');
export const magnifySizeSlider = document.getElementById('magnify-size-slider');
export const lifeTotalEl = document.getElementById('life-total');
export const increaseLifeBtn = document.getElementById('increase-life-btn');
export const decreaseLifeBtn = document.getElementById('decrease-life-btn');

// Utility functions
export function showMessage(message) {
    messageText.textContent = message;
    messageModal.classList.remove('hidden');
}

export function generateCardId() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    // Fallback: timestamp + random
    return 'card-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
}

// Cache for heart SVG content
let heartSVGContent = null;

// Load heart SVG content
export async function loadHeartSVG() {
    if (heartSVGContent) return heartSVGContent;
    
    try {
        const response = await fetch('heart.svg');
        const text = await response.text();
        heartSVGContent = text;
        return heartSVGContent;
    } catch (error) {
        console.error('Failed to load heart.svg:', error);
        // Fallback inline SVG if heart.svg fails to load
        heartSVGContent = `<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
            <path d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Zm0-108q96-86 158-147.5t98-107q36-45.5 50-81t14-70.5q0-60-40-100t-100-40q-47 0-87 26.5T518-680h-76q-15-41-55-67.5T300-774q-60 0-100 40t-40 100q0 35 14 70.5t50 81q36 45.5 98 107T480-228Zm0-273Z"/>
        </svg>`;
        return heartSVGContent;
    }
}

// Helper function to create heart icon with specific styling
export function createHeartIcon(size = '14px', color = '#ef4444') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(heartSVGContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    if (svg) {
        svg.setAttribute('height', size);
        svg.setAttribute('width', size);
        svg.setAttribute('fill', color);
        return svg.outerHTML;
    }
    
    // Fallback
    return `<img src="heart.svg" alt="♥" style="width: ${size}; height: ${size}; filter: hue-rotate(0deg) saturate(2) brightness(0.8);">`;
}

// Utility function for shuffling arrays
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Utility function for intersection checking
export function checkIntersection(rect1, rect2) {
    return rect1.left < rect2.right &&
           rect1.right > rect2.left &&
           rect1.top < rect2.bottom &&
           rect1.bottom > rect2.top;
}

// Loading indicator functions
export function showLoadingIndicator(text = 'Loading...', subtext = 'Please wait while images are loaded') {
    loadingText.textContent = text;
    loadingSubtext.textContent = subtext;
    loadingOverlay.classList.remove('hidden');
}

export function hideLoadingIndicator() {
    loadingOverlay.classList.add('hidden');
}

export function updateLoadingProgress(current, total, itemName = 'images') {
    const percentage = Math.round((current / total) * 100);
    loadingText.textContent = `Loading ${itemName}... ${percentage}%`;
    loadingSubtext.textContent = `${current} of ${total} ${itemName} loaded`;
}
