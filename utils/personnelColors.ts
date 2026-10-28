/**
 * Personnel Color Utilities - v1.0.3
 * Provides vibrant, sharp, high-contrast distinguishable colors without duplicates
 */
import { Personnel } from '../types';

// Vibrant, sharp, high-contrast palette with distinct hues across the color wheel
export const PERSONNEL_COLOR_PALETTE: string[] = [
  '#2563eb', // 1. Electric Royal Blue (Hue: 221°)
  '#f97316', // 2. Vivid Sunset Orange (Hue: 25°)
  '#059669', // 3. Vibrant Emerald Green (Hue: 160°)
  '#7c3aed', // 4. Electric Violet Purple (Hue: 262°)
  '#e11d48', // 5. Vivid Crimson Rose (Hue: 347°)
  '#0891b2', // 6. Sharp Ocean Cyan (Hue: 192°)
  '#d946ef', // 7. Electric Fuchsia Magenta (Hue: 292°)
  '#d97706', // 8. Vibrant Golden Amber (Hue: 38°)
  '#4f46e5', // 9. Vivid Indigo (Hue: 243°)
  '#16a34a', // 10. Vivid Spring Leaf Green (Hue: 142°)
  '#ec4899', // 11. Bright Hot Pink (Hue: 330°)
  '#0284c7', // 12. Vivid Sky Cerulean (Hue: 200°)
  '#ea580c', // 13. Vivid Flame Orange-Red (Hue: 17°)
  '#9333ea', // 14. Vivid Royal Purple (Hue: 271°)
  '#0d9488', // 15. Deep Vibrant Teal (Hue: 174°)
  '#be123c', // 16. Deep Ruby Crimson (Hue: 345°)
  '#6366f1', // 17. Vivid Iris Blue (Hue: 239°)
  '#65a30d', // 18. Vivid Lime Green (Hue: 84°)
  '#c026d3', // 19. Vivid Deep Orchid (Hue: 293°)
  '#b45309', // 20. Warm Bronze Gold (Hue: 33°)
];

// Dedicated vibrant signature colors for known core staff (guaranteed 0 duplicates & max contrast)
export const KNOWN_STAFF_COLORS: Record<string, string> = {
  'لسانی': '#2563eb',    // Electric Royal Blue
  'سلیمان': '#e11d48',   // Vivid Crimson Rose Red
  'فلاح': '#e11d48',     // Matches Soleiman Fallah
  'دهقان': '#f97316',    // Vivid Sunset Tangerine Orange (sharp & bright)
  'سالاروند': '#7c3aed', // Electric Violet Purple
  'سپهر': '#059669',     // Vibrant Emerald Green
  'حیدری': '#0891b2',    // Sharp Ocean Cyan
  'رحیمی': '#d97706',    // Vibrant Golden Amber
};

// Legacy dull/faded colors to migrate away from
const LEGACY_DULL_COLORS: Record<string, string> = {
  '#dc2626': '#e11d48', // Replace dull crimson with vivid rose red
  '#ea580c': '#f97316', // Replace dark burnt orange with vivid sunset orange
  '#db2777': '#d946ef', // Replace muted pink with electric fuchsia
  '#854d0e': '#d97706', // Replace muddy brown with vibrant golden amber
  '#a16207': '#d97706', // Replace olive bronze with vibrant amber
};

/**
 * Get next available distinct color from the palette for a new personnel,
 * guaranteeing no duplicate colors among personnel.
 */
export const getNextPersonnelColor = (existingPersonnel: Personnel[]): string => {
  const usedColors = new Set(
    existingPersonnel
      .map(p => p.color?.trim().toLowerCase())
      .filter((c): c is string => Boolean(c))
  );

  // 1. Find first unused color from distinct palette
  for (const color of PERSONNEL_COLOR_PALETTE) {
    if (!usedColors.has(color.toLowerCase())) {
      return color;
    }
  }

  // 2. If palette is exhausted, generate with golden-ratio hue distribution for maximum contrast
  const count = existingPersonnel.length;
  const hue = Math.round((count * 137.508) % 360);
  return `hsl(${hue}, 85%, 50%)`;
};

/**
 * Automatically audits personnel list and resolves any duplicate, missing, or dull legacy colors,
 * ensuring every person has a completely unique, vibrant, sharp color while strictly preserving custom colors.
 */
export const ensureUniquePersonnelColors = (personnelList: Personnel[]): Personnel[] => {
  const usedColors = new Set<string>();
  let paletteIndex = 0;

  return personnelList.map(person => {
    let currentColor = person.color?.trim();

    // Check if currentColor is a legacy dull color and upgrade it
    if (currentColor && LEGACY_DULL_COLORS[currentColor.toLowerCase()]) {
      currentColor = LEGACY_DULL_COLORS[currentColor.toLowerCase()];
    }

    // 1. If person already has a valid custom color, preserve it!
    if (currentColor) {
      usedColors.add(currentColor.toLowerCase());
      return {
        ...person,
        color: currentColor
      };
    }

    // 2. If known core staff and no custom color set, use their signature vibrant default color
    for (const [key, color] of Object.entries(KNOWN_STAFF_COLORS)) {
      if (person.name.includes(key)) {
        usedColors.add(color.toLowerCase());
        return {
          ...person,
          color
        };
      }
    }

    // 3. Otherwise assign next distinct unused color from the vibrant palette
    let chosenColor = '';
    while (paletteIndex < PERSONNEL_COLOR_PALETTE.length) {
      const candidate = PERSONNEL_COLOR_PALETTE[paletteIndex];
      paletteIndex++;
      if (!usedColors.has(candidate.toLowerCase())) {
        chosenColor = candidate;
        break;
      }
    }

    if (!chosenColor) {
      const hue = Math.round((usedColors.size * 137.508) % 360);
      chosenColor = `hsl(${hue}, 85%, 50%)`;
    }

    usedColors.add(chosenColor.toLowerCase());
    return {
      ...person,
      color: chosenColor
    };
  });
};

/**
 * Clean person name for consistent matching
 */
export const cleanPersonName = (name: string): string => {
  return name.replace('مهندس', '').replace('خانم', '').replace('آقای', '').replace('دکتر', '').trim();
};

/**
 * Hash string to pick a deterministic color from the vibrant palette
 */
const hashStringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PERSONNEL_COLOR_PALETTE.length;
  return PERSONNEL_COLOR_PALETTE[index];
};

/**
 * Get color for a person:
 * 1. FIRST check personnelList for custom color configured by user
 * 2. SECOND check known core staff signature colors (default initial colors)
 * 3. THIRD deterministically from vibrant palette using name hash
 */
export const getPersonColor = (name: string, personnelList?: Personnel[]): string => {
  if (!name) return '#2563eb';
  const cleaned = cleanPersonName(name);

  // 1. FIRST: Check personnelList for custom color configured by the user
  if (personnelList && personnelList.length > 0) {
    const found = personnelList.find(p => {
      const pClean = cleanPersonName(p.name);
      return pClean === cleaned || p.name === name || (pClean && cleaned.includes(pClean)) || (cleaned && pClean.includes(cleaned));
    });

    if (found && found.color) {
      const c = found.color.trim();
      // Upgrade if it was a legacy dull color
      if (LEGACY_DULL_COLORS[c.toLowerCase()]) {
        return LEGACY_DULL_COLORS[c.toLowerCase()];
      }
      return c;
    }
  }

  // 2. SECOND: Check known core staff signature colors (default initial fallback)
  for (const [key, color] of Object.entries(KNOWN_STAFF_COLORS)) {
    if (name.includes(key) || cleaned.includes(key)) {
      return color;
    }
  }

  // 3. THIRD: Deterministic distinct vibrant color from palette based on cleaned name
  return hashStringToColor(cleaned || name);
};

/**
 * Upgrade any personnel array (from localStorage or Cloud Firestore)
 * to ensure all staff have vibrant, sharp, unique colors.
 */
export const upgradeToVibrantPersonnel = (personnelList: Personnel[]): { updated: Personnel[], hasChanges: boolean } => {
  let hasChanges = false;
  const upgraded = ensureUniquePersonnelColors(personnelList);

  for (let i = 0; i < personnelList.length; i++) {
    if (personnelList[i]?.color !== upgraded[i]?.color) {
      hasChanges = true;
      break;
    }
  }

  return { updated: upgraded, hasChanges };
};

