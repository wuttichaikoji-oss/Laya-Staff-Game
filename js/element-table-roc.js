/**
 * ROC Element Table (Level 1–4)
 * Columns = attacking element, Rows = defending element.
 *
 * Usage:
 *   import { ELEMENTS, ELEMENT_TABLE, elementMultiplier, elementPercent, applyElement } from "./element-table-roc.js";
 */

export const ELEMENTS = ["Neutral", "Water", "Earth", "Fire", "Wind", "Poison", "Holy", "Shadow", "Ghost", "Undead"];

export const ELEMENT_TABLE = {
  "1": {
    "Neutral": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 100,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 70,
      "Undead": 100
    },
    "Water": {
      "Neutral": 100,
      "Water": 25,
      "Earth": 100,
      "Fire": 90,
      "Wind": 175,
      "Poison": 100,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 100,
      "Undead": 100
    },
    "Earth": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 25,
      "Fire": 150,
      "Wind": 90,
      "Poison": 125,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 100,
      "Undead": 100
    },
    "Fire": {
      "Neutral": 100,
      "Water": 150,
      "Earth": 90,
      "Fire": 25,
      "Wind": 100,
      "Poison": 125,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 100,
      "Undead": 100
    },
    "Wind": {
      "Neutral": 100,
      "Water": 90,
      "Earth": 150,
      "Fire": 100,
      "Wind": 25,
      "Poison": 125,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 100,
      "Undead": 100
    },
    "Poison": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 0,
      "Holy": 100,
      "Shadow": 50,
      "Ghost": 100,
      "Undead": 50
    },
    "Holy": {
      "Neutral": 100,
      "Water": 75,
      "Earth": 75,
      "Fire": 75,
      "Wind": 75,
      "Poison": 75,
      "Holy": 0,
      "Shadow": 125,
      "Ghost": 75,
      "Undead": 100
    },
    "Shadow": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 50,
      "Holy": 125,
      "Shadow": 0,
      "Ghost": 75,
      "Undead": 0
    },
    "Ghost": {
      "Neutral": 70,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 100,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 125,
      "Undead": 100
    },
    "Undead": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 125,
      "Wind": 100,
      "Poison": -25,
      "Holy": 150,
      "Shadow": -25,
      "Ghost": 100,
      "Undead": 0
    }
  },
  "2": {
    "Neutral": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 100,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 50,
      "Undead": 100
    },
    "Water": {
      "Neutral": 100,
      "Water": 0,
      "Earth": 100,
      "Fire": 80,
      "Wind": 175,
      "Poison": 75,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 75,
      "Undead": 75
    },
    "Earth": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 0,
      "Fire": 175,
      "Wind": 80,
      "Poison": 125,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 75,
      "Undead": 75
    },
    "Fire": {
      "Neutral": 100,
      "Water": 175,
      "Earth": 90,
      "Fire": 0,
      "Wind": 100,
      "Poison": 125,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 75,
      "Undead": 75
    },
    "Wind": {
      "Neutral": 100,
      "Water": 80,
      "Earth": 175,
      "Fire": 100,
      "Wind": 0,
      "Poison": 125,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 75,
      "Undead": 75
    },
    "Poison": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 0,
      "Holy": 100,
      "Shadow": 25,
      "Ghost": 75,
      "Undead": 25
    },
    "Holy": {
      "Neutral": 100,
      "Water": 50,
      "Earth": 50,
      "Fire": 50,
      "Wind": 50,
      "Poison": 50,
      "Holy": -25,
      "Shadow": 150,
      "Ghost": 50,
      "Undead": 125
    },
    "Shadow": {
      "Neutral": 100,
      "Water": 75,
      "Earth": 75,
      "Fire": 75,
      "Wind": 75,
      "Poison": 25,
      "Holy": 150,
      "Shadow": -25,
      "Ghost": 50,
      "Undead": 0
    },
    "Ghost": {
      "Neutral": 50,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 75,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 150,
      "Undead": 100
    },
    "Undead": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 150,
      "Wind": 100,
      "Poison": -50,
      "Holy": 175,
      "Shadow": -50,
      "Ghost": 125,
      "Undead": 0
    }
  },
  "3": {
    "Neutral": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 100,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 0,
      "Undead": 100
    },
    "Water": {
      "Neutral": 100,
      "Water": -25,
      "Earth": 100,
      "Fire": 70,
      "Wind": 200,
      "Poison": 50,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 50,
      "Undead": 50
    },
    "Earth": {
      "Neutral": 100,
      "Water": 100,
      "Earth": -25,
      "Fire": 200,
      "Wind": 70,
      "Poison": 100,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 50,
      "Undead": 50
    },
    "Fire": {
      "Neutral": 100,
      "Water": 200,
      "Earth": 70,
      "Fire": -25,
      "Wind": 100,
      "Poison": 100,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 50,
      "Undead": 50
    },
    "Wind": {
      "Neutral": 100,
      "Water": 70,
      "Earth": 200,
      "Fire": 100,
      "Wind": -25,
      "Poison": 100,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 50,
      "Undead": 50
    },
    "Poison": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 0,
      "Holy": 125,
      "Shadow": 0,
      "Ghost": 50,
      "Undead": 0
    },
    "Holy": {
      "Neutral": 100,
      "Water": 25,
      "Earth": 25,
      "Fire": 25,
      "Wind": 25,
      "Poison": 25,
      "Holy": -50,
      "Shadow": 175,
      "Ghost": 25,
      "Undead": 150
    },
    "Shadow": {
      "Neutral": 100,
      "Water": 50,
      "Earth": 50,
      "Fire": 50,
      "Wind": 50,
      "Poison": 0,
      "Holy": 175,
      "Shadow": -50,
      "Ghost": 25,
      "Undead": 0
    },
    "Ghost": {
      "Neutral": 0,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 50,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 175,
      "Undead": 100
    },
    "Undead": {
      "Neutral": 100,
      "Water": 125,
      "Earth": 100,
      "Fire": 175,
      "Wind": 100,
      "Poison": -75,
      "Holy": 200,
      "Shadow": -75,
      "Ghost": 150,
      "Undead": 0
    }
  },
  "4": {
    "Neutral": {
      "Neutral": 100,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 100,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 0,
      "Undead": 100
    },
    "Water": {
      "Neutral": 100,
      "Water": -50,
      "Earth": 100,
      "Fire": 60,
      "Wind": 200,
      "Poison": 25,
      "Holy": 75,
      "Shadow": 75,
      "Ghost": 25,
      "Undead": 25
    },
    "Earth": {
      "Neutral": 100,
      "Water": 100,
      "Earth": -50,
      "Fire": 200,
      "Wind": 60,
      "Poison": 75,
      "Holy": 75,
      "Shadow": 75,
      "Ghost": 25,
      "Undead": 25
    },
    "Fire": {
      "Neutral": 100,
      "Water": 200,
      "Earth": 60,
      "Fire": -50,
      "Wind": 100,
      "Poison": 75,
      "Holy": 75,
      "Shadow": 75,
      "Ghost": 25,
      "Undead": 25
    },
    "Wind": {
      "Neutral": 100,
      "Water": 60,
      "Earth": 200,
      "Fire": 100,
      "Wind": -50,
      "Poison": 75,
      "Holy": 75,
      "Shadow": 75,
      "Ghost": 25,
      "Undead": 25
    },
    "Poison": {
      "Neutral": 100,
      "Water": 75,
      "Earth": 75,
      "Fire": 75,
      "Wind": 75,
      "Poison": 0,
      "Holy": 125,
      "Shadow": -25,
      "Ghost": 25,
      "Undead": -25
    },
    "Holy": {
      "Neutral": 100,
      "Water": 0,
      "Earth": 0,
      "Fire": 0,
      "Wind": 0,
      "Poison": 0,
      "Holy": -100,
      "Shadow": 200,
      "Ghost": 0,
      "Undead": 175
    },
    "Shadow": {
      "Neutral": 100,
      "Water": 25,
      "Earth": 25,
      "Fire": 25,
      "Wind": 25,
      "Poison": -25,
      "Holy": 200,
      "Shadow": -100,
      "Ghost": 0,
      "Undead": 0
    },
    "Ghost": {
      "Neutral": 0,
      "Water": 100,
      "Earth": 100,
      "Fire": 100,
      "Wind": 100,
      "Poison": 25,
      "Holy": 100,
      "Shadow": 100,
      "Ghost": 200,
      "Undead": 100
    },
    "Undead": {
      "Neutral": 100,
      "Water": 150,
      "Earth": 50,
      "Fire": 200,
      "Wind": 100,
      "Poison": -100,
      "Holy": 200,
      "Shadow": -100,
      "Ghost": 175,
      "Undead": 0
    }
  }
};

/** Return percent (e.g., 175 means 175%) */
export function elementPercent(atkElement, defElement, defLevel = 1) {
  const lvl = Number(defLevel) || 1;
  const row = ELEMENT_TABLE[lvl]?.[defElement];
  const pct = row?.[atkElement];
  return (pct ?? 100);
}

/** Return multiplier (e.g., 175% => 1.75) */
export function elementMultiplier(atkElement, defElement, defLevel = 1) {
  return elementPercent(atkElement, defElement, defLevel) / 100;
}

/**
 * Apply element multiplier to baseDamage.
 * - If you don't want "negative damage" (heal-like behavior), set clampMin=0.
 */
export function applyElement(baseDamage, atkElement, defElement, defLevel = 1, clampMin = 0) {
  const mul = elementMultiplier(atkElement, defElement, defLevel);
  const dmg = baseDamage * mul;
  return Math.max(clampMin, dmg);
}
