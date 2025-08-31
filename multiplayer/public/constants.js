// Game constants and configuration
export const CARD_SIZES = {
    MIN: 60,
    MAX: 200,
    STEP: 10,
    DEFAULT: 80
};

export const MAGNIFY_DEFAULTS = {
    WIDTH: 320,
    HEIGHT: Math.round(320 * (107 / 80)) // Standard Magic card ratio
};

export const CASCADE_CONFIG = {
    OFFSET: 15,
    INITIAL_X: 10,
    INITIAL_Y: 10,
    MAX_CARDS_PER_ROW: 5,
    AREA_MAX_X: 300,
    AREA_MAX_Y: 300
};

export const DEBOUNCE_TIMES = {
    RENDER: 16, // ~60fps
    SEND_MOVE: 50,
    TAP_UNTAP: 100
};

export const CLIENT_ACTION_TIMEOUT = 2000; // 2 seconds for optimistic updates

export const DEFAULT_LIFE_TOTAL = 40;
