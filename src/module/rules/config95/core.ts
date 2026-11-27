/**
 * v0.95.0 rules completeness: Core mechanics and characters. Read through RULES.CORE_V95. Book rules the system did not have before v0.95.0, each
 * with its book and page in the comment. Each switch's first choice is the book's way (the default; an optional book
 * rule ships off); the other choice puts the v0.94.2 behaviour back. Pure logic lives beside it in rules/.
 */
export const CORE_V95 = {
};

/** The house-rules window's rows for CORE_V95 (spread into settings.ts HOUSE_RULES). */
export const HOUSE_CORE_V95: Array<{ path: string; section: string; type: 'number' | 'boolean' | 'select'; choices?: string[]; step?: number }> = [
];
