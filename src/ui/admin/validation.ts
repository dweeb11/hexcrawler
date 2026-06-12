import type { Biome, Choice, Encounter } from "../../engine/state";

export interface AdminRumor {
  id: string;
  title: string;
  premise: string;
  steps: AdminRumorStep[];
  rewardId: string | null;
  hopeBonus: number;
}

export interface AdminRumorStep {
  stepIndex: number;
  stepTitle: string;
  encounterId: string;
  journalHint: string;
  hintTags: string[];
  hintBiomes?: Biome[];
}

export interface ValidationIssue {
  scope: "encounter" | "rumor" | "cross";
  id: string;
  field: string;
  message: string;
}

function choiceIssues(choice: Choice, index: number, rumorIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const prefix = `choices[${index}]`;

  if (!choice.label.trim()) {
    issues.push({
      scope: "encounter",
      id: "",
      field: `${prefix}.label`,
      message: "Choice label is required.",
    });
  }

  if (choice.chance !== undefined && (choice.chance < 0 || choice.chance > 1)) {
    issues.push({
      scope: "encounter",
      id: "",
      field: `${prefix}.chance`,
      message: "Chance must be between 0 and 1.",
    });
  }

  if (choice.discoversRumor && !rumorIds.has(choice.discoversRumor)) {
    issues.push({
      scope: "encounter",
      id: "",
      field: `${prefix}.discoversRumor`,
      message: `Unknown rumor id "${choice.discoversRumor}".`,
    });
  }

  return issues;
}

export function validateEncounterPayload(
  encounter: Encounter,
  rumorIds: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!encounter.id.trim()) {
    issues.push({
      scope: "encounter",
      id: encounter.id,
      field: "id",
      message: "Encounter id is required.",
    });
  }

  if (!encounter.text.trim()) {
    issues.push({
      scope: "encounter",
      id: encounter.id,
      field: "text",
      message: "Encounter text is required.",
    });
  }

  if (encounter.choices.length === 0) {
    issues.push({
      scope: "encounter",
      id: encounter.id,
      field: "choices",
      message: "At least one choice is required.",
    });
  }

  encounter.choices.forEach((choice, index) => {
    for (const issue of choiceIssues(choice, index, rumorIds)) {
      issues.push({ ...issue, id: encounter.id });
    }
  });

  return issues;
}

export function validateRumorPayload(
  rumor: AdminRumor,
  encounterIds: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!rumor.id.trim()) {
    issues.push({
      scope: "rumor",
      id: rumor.id,
      field: "id",
      message: "Rumor id is required.",
    });
  }

  if (!rumor.title.trim()) {
    issues.push({
      scope: "rumor",
      id: rumor.id,
      field: "title",
      message: "Rumor title is required.",
    });
  }

  if (rumor.steps.length === 0) {
    issues.push({
      scope: "rumor",
      id: rumor.id,
      field: "steps",
      message: "At least one step is required.",
    });
  }

  rumor.steps.forEach((step, index) => {
    const prefix = `steps[${index}]`;

    if (!step.encounterId.trim()) {
      issues.push({
        scope: "rumor",
        id: rumor.id,
        field: `${prefix}.encounterId`,
        message: "Step encounter id is required.",
      });
      return;
    }

    if (!encounterIds.has(step.encounterId)) {
      issues.push({
        scope: "rumor",
        id: rumor.id,
        field: `${prefix}.encounterId`,
        message: `Encounter "${step.encounterId}" not found.`,
      });
    }

    if (!step.journalHint.trim()) {
      issues.push({
        scope: "rumor",
        id: rumor.id,
        field: `${prefix}.journalHint`,
        message: "Journal hint is required.",
      });
    }
  });

  return issues;
}

export function validateContentCrossReferences(
  encounters: Encounter[],
  rumors: AdminRumor[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const encounterIds = new Set(encounters.map((encounter) => encounter.id));
  const rumorIds = new Set(rumors.map((rumor) => rumor.id));

  for (const rumor of rumors) {
    issues.push(...validateRumorPayload(rumor, encounterIds));
  }

  for (const encounter of encounters) {
    encounter.choices.forEach((choice, index) => {
      if (choice.discoversRumor && !rumorIds.has(choice.discoversRumor)) {
        issues.push({
          scope: "cross",
          id: encounter.id,
          field: `choices[${index}].discoversRumor`,
          message: `Choice references unknown rumor "${choice.discoversRumor}".`,
        });
      }
    });
  }

  const referencedEncounterIds = new Set(
    rumors.flatMap((rumor) => rumor.steps.map((step) => step.encounterId)),
  );

  for (const encounterId of referencedEncounterIds) {
    if (!encounterIds.has(encounterId)) {
      issues.push({
        scope: "cross",
        id: encounterId,
        field: "encounterId",
        message: `Rumor step references missing encounter "${encounterId}".`,
      });
    }
  }

  return issues;
}

export function filterEncounters(encounters: Encounter[], query: string): Encounter[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return encounters;
  }

  return encounters.filter((encounter) => {
    const haystack = [
      encounter.id,
      encounter.text,
      encounter.requiredTags.join(" "),
      encounter.biomes?.join(" ") ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
