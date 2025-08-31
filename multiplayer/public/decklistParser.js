// Decklist parsing utilities
// Handles parsing of decklists with quantities, commanders, and set codes

export function parseDecklistText(decklistRaw) {
    if (!decklistRaw || !decklistRaw.trim()) {
        return { decklist: [], commanders: [] };
    }

    const decklist = [];
    const commanders = [];
    
    // Split by lines and handle empty lines to detect commander section
    const lines = decklistRaw.split('\n').map(line => line.trim());
    
    // Find the last empty line to determine if there's a commander section
    let lastEmptyLineIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i] === '') {
            lastEmptyLineIndex = i;
            break;
        }
    }
    
    // Determine which lines are commanders vs library cards
    const isCommanderSection = (index) => {
        // Cards marked with (CMDR) are always commanders
        if (/\(CMDR\)/i.test(lines[index])) {
            return true;
        }
        // If there's an empty line and this card is after it (and it's the last section), it's a commander
        if (lastEmptyLineIndex >= 0 && index > lastEmptyLineIndex) {
            return true;
        }
        return false;
    };
    
    lines.forEach((line, index) => {
        if (!line) return; // Skip empty lines
        
        const isCommander = isCommanderSection(index);
        
        // Parse count and card name, e.g. "2 Arcane Signet" or "1x Arcane Signet" or "Arcane Signet"
        const countMatch = line.match(/^(\d+)\s*x?\s*(.+)$/);
        let cardName, count;
        
        if (countMatch) {
            count = parseInt(countMatch[1]);
            cardName = countMatch[2];
        } else {
            // No count specified, assume 1 copy
            count = 1;
            cardName = line;
        }
        
        // Remove set codes like "(M21)" and commander marker "(CMDR)"
        cardName = cardName.replace(/\s+\([^)]*\)$/g, '').trim();
        
        // Add the specified number of copies to the appropriate zone
        const targetArray = isCommander ? commanders : decklist;
        for (let i = 0; i < count; i++) {
            targetArray.push(cardName);
        }
    });
    
    return { decklist, commanders };
}

// Example usage and test function
export function testDecklistParser() {
    const testDecklist = `4 Lightning Bolt
2 Sol Ring
1 Black Lotus
1x Counterspell

Thrasios, Triton Hero (CMDR)`;

    const result = parseDecklistText(testDecklist);
    console.log('Test result:', result);
    // Should produce:
    // decklist: ["Lightning Bolt", "Lightning Bolt", "Lightning Bolt", "Lightning Bolt", "Sol Ring", "Sol Ring", "Black Lotus", "Counterspell"]
    // commanders: ["Thrasios, Triton Hero"]
    
    return result;
}
