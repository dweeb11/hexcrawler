import type { Relic } from "../state";

export const ALL_RELICS: Relic[] = [
  {
    id: "ember-compass",
    name: "The Ember Compass",
    description: "A compass that tilts toward safe warmth and hidden forage.",
    effect: { type: "forage_bonus", chance: 0.15 },
  },
  {
    id: "deep-pack",
    name: "Deep Pack",
    description: "A stitched pack with impossible depth and balanced weight.",
    effect: { type: "max_resource", resource: "supply", bonus: 2 },
  },
  {
    id: "warded-mail",
    name: "Warded Mail",
    description: "Rings etched with old sigils blunt the bite of the road.",
    effect: { type: "max_resource", resource: "health", bonus: 1 },
  },
  {
    id: "starseer-lens",
    name: "Starseer Lens",
    description: "A polished lens that reveals safer footing on steep ground.",
    effect: { type: "move_discount", chance: 0.15 },
  },
  {
    id: "cinder-prayer",
    name: "Cinder Prayer",
    description: "A knotted prayer-cord that steadies the mind over long marches.",
    effect: { type: "hope_decay_slow", intervalBonus: 2 },
  },
  {
    id: "well-sigil",
    name: "Well Sigil",
    description: "A bronze seal carried by old well-keepers, warm to the touch.",
    effect: { type: "max_resource", resource: "hope", bonus: 1 },
  },
  {
    id: "glass-spikes",
    name: "Glass Spikes",
    description: "Heat-treated climbing spikes that shave effort from each push.",
    effect: { type: "move_discount", chance: 0.1 },
  },
  {
    id: "forager-rig",
    name: "Forager Rig",
    description: "A harness of hooks and satchels meant for quick salvage runs.",
    effect: { type: "forage_bonus", chance: 0.1 },
  },
];
