import type { Rumor } from "../state";
import { ALL_RELICS } from "./relics";

function relicById(id: string) {
  return ALL_RELICS.find((relic) => relic.id === id) ?? null;
}

export const ALL_RUMORS: Rumor[] = [
  {
    id: "whispering-well",
    title: "The Whispering Well",
    steps: [
      {
        stepIndex: 0,
        encounterId: "ww-step-0",
        hint: "The first marker lies where old forest stones keep clean water.",
        hintTags: ["water", "ancient"],
        hintBiomes: ["forest"],
      },
      {
        stepIndex: 1,
        encounterId: "ww-step-1",
        hint: "Seek ruined masonry where underground channels still run.",
        hintTags: ["stone", "water"],
        hintBiomes: ["ruins"],
      },
      {
        stepIndex: 2,
        encounterId: "ww-step-2",
        hint: "The well waits in a sacred hollow that heat forgot.",
        hintTags: ["hollow", "sacred"],
      },
    ],
    reward: relicById("well-sigil"),
    hopeBonus: 3,
  },
  {
    id: "ashen-observatory",
    title: "Ashen Observatory",
    steps: [
      {
        stepIndex: 0,
        encounterId: "ao-step-0",
        hint: "A scorched marker points to high ground in the mountains.",
        hintTags: ["scarred", "elevated"],
        hintBiomes: ["mountain"],
      },
      {
        stepIndex: 1,
        encounterId: "ao-step-1",
        hint: "Find the old stone dome where the first maps were cut.",
        hintTags: ["ancient", "stone"],
        hintBiomes: ["ruins", "mountain"],
      },
      {
        stepIndex: 2,
        encounterId: "ao-step-2",
        hint: "The final mirror stands where scars and altitude meet.",
        hintTags: ["elevated", "scarred", "ancient"],
      },
    ],
    reward: relicById("starseer-lens"),
    hopeBonus: 2,
  },
  {
    id: "pilgrim-lantern",
    title: "Pilgrim Lantern",
    steps: [
      {
        stepIndex: 0,
        encounterId: "pl-step-0",
        hint: "Pilgrim marks hide in sheltered places blessed by old rites.",
        hintTags: ["sheltered", "sacred"],
        hintBiomes: ["settlement", "forest"],
      },
      {
        stepIndex: 1,
        encounterId: "pl-step-1",
        hint: "Carry the flame to carved stone altars.",
        hintTags: ["stone", "sacred"],
      },
      {
        stepIndex: 2,
        encounterId: "pl-step-2",
        hint: "Its reliquary lies in an overgrown sacred court.",
        hintTags: ["overgrown", "sacred", "ancient"],
      },
    ],
    reward: relicById("cinder-prayer"),
    hopeBonus: 3,
  },
  {
    id: "drowned-archives",
    title: "Drowned Archives",
    steps: [
      {
        stepIndex: 0,
        encounterId: "da-step-0",
        hint: "Start where floodwater crosses broken stone roads.",
        hintTags: ["flooded", "stone"],
        hintBiomes: ["wastes", "ruins"],
      },
      {
        stepIndex: 1,
        encounterId: "da-step-1",
        hint: "A sealed door waits near abandoned waterworks.",
        hintTags: ["abandoned", "water"],
      },
      {
        stepIndex: 2,
        encounterId: "da-step-2",
        hint: "The deepest records lie in a hall the flood never fully surrendered.",
        hintTags: ["flooded", "ancient", "stone"],
      },
    ],
    reward: relicById("deep-pack"),
    hopeBonus: 2,
  },
];
