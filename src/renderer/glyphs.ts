import type { Biome } from "../engine/state";

export const COLORS = {
  bg: "#0a0a0a",
  text: "#c0c0c0",
  textDim: "#5c5c5c",
  border: "#2f2f2f",
  fog: "#121212",
  fogEdge: "#202020",
  consumed: "#200708",
  consumedEdge: "#5a0f12",
  encounter: "#ff6644",
  player: "#ffcc00",
  searing: "#ff2d00",
  panel: "#101010",
  panelEdge: "#2a2a2a",
  biome: {
    forest: "#3b6d3f",
    mountain: "#8d8d8d",
    ruins: "#9b7654",
    settlement: "#d5b36b",
    wastes: "#715343",
  } as Record<Biome, string>,
};

export const BIOME_GLYPHS: Record<Biome, string> = {
  forest: "#",
  mountain: "^",
  ruins: "O",
  settlement: "H",
  wastes: "~",
};

export const TAG_GLYPHS: Record<string, string> = {
  water: "=",
  stone: "o",
  wood: "+",
  elevated: "/",
  sheltered: "]",
  overgrown: "*",
  flooded: "_",
  hollow: "u",
  sacred: "+",
  ancient: ":",
  inhabited: "@",
  abandoned: "0",
  scarred: "x",
  sand: ".",
  ice: "*",
};
