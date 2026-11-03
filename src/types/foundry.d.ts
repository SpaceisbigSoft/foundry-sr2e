/**
 * Minimal ambient declarations for Foundry globals. Replace with the community
 * foundry-vtt-types package once it supports v14; until then these are `any`.
 */
declare const foundry: any;
declare const game: any;
declare const CONFIG: any;
declare const Hooks: any;
declare const Roll: any;
declare const ChatMessage: any;
declare const Actor: any;
declare const Item: any;
declare const Combat: any;
declare const Combatant: any;
declare const Actors: any;
declare const Items: any;
declare const ui: any;
declare function fromUuid(uuid: string): Promise<any>;
declare function fromUuidSync(uuid: string): any;
declare const canvas: any;
