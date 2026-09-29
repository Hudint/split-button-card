// Port of the frontend's visibility conditions
// (panels/lovelace/common/validate-condition.ts), evaluated per button.
import type { HomeAssistant } from "./types";

export type Condition = Record<string, any>;

const ensureArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

const isEntityId = (value: string) => /^\w+\.\w+$/.test(value);

const valueFromEntityId = (hass: HomeAssistant, value: string) =>
  isEntityId(value) ? hass.states[value]?.state : undefined;

const conditionEntity = (condition: Condition, entityId?: string): string | undefined =>
  condition.entity_id || condition.entity || entityId;

const checkState = (condition: Condition, hass: HomeAssistant, entityId?: string) => {
  const stateObj = hass.states[conditionEntity(condition, entityId) ?? ""];
  let state: string;
  if (!stateObj) {
    state = "unknown";
  } else if (condition.attribute) {
    const attr = stateObj.attributes[condition.attribute];
    state = attr == null ? "unknown" : String(attr);
  } else {
    state = stateObj.state;
  }

  const raw = condition.state ?? condition.state_not;
  if (raw === undefined) return false;
  const values = ensureArray<string>(raw).map(String);
  const expected = [
    ...values,
    ...values.map((v) => valueFromEntityId(hass, v)).filter((v): v is string => v !== undefined),
  ];
  return condition.state != null ? expected.includes(state) : !expected.includes(state);
};

const checkNumericState = (condition: Condition, hass: HomeAssistant, entityId?: string) => {
  const stateObj = hass.states[conditionEntity(condition, entityId) ?? ""];
  const state = Number(
    condition.attribute ? stateObj?.attributes[condition.attribute] : stateObj?.state
  );
  if (Number.isNaN(state)) return false;

  const resolve = (v: unknown) =>
    Number(typeof v === "string" ? (valueFromEntityId(hass, v) ?? v) : v);
  const above = resolve(condition.above);
  const below = resolve(condition.below);
  return (
    (condition.above == null || Number.isNaN(above) || above < state) &&
    (condition.below == null || Number.isNaN(below) || below > state)
  );
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const toSeconds = (time: string) => {
  const [h = 0, m = 0, s = 0] = time.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

// Evaluated in the browser's local time.
const checkTime = (condition: Condition) => {
  const now = new Date();
  if (condition.weekdays && !ensureArray<string>(condition.weekdays).includes(WEEKDAYS[now.getDay()])) {
    return false;
  }
  const current = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const after = condition.after ? toSeconds(condition.after) : undefined;
  const before = condition.before ? toSeconds(condition.before) : undefined;
  if (after !== undefined && before !== undefined && after > before) {
    // Range crosses midnight.
    return current >= after || current < before;
  }
  return (after === undefined || current >= after) && (before === undefined || current < before);
};

const checkLocation = (condition: Condition, hass: HomeAssistant) => {
  const userId = hass.user?.id;
  const person = Object.values(hass.states).find(
    (s) => s.entity_id.startsWith("person.") && s.attributes.user_id === userId
  );
  return !!person && ensureArray<string>(condition.locations ?? []).includes(person.state);
};

export const checkConditionsMet = (
  conditions: Condition[],
  hass: HomeAssistant,
  entityId?: string
): boolean =>
  conditions.every((c) => {
    switch (c.condition) {
      case "numeric_state":
        return checkNumericState(c, hass, entityId);
      case "screen":
        return c.media_query ? matchMedia(c.media_query).matches : false;
      case "user":
        return c.users && hass.user?.id ? c.users.includes(hass.user.id) : false;
      case "time":
        return checkTime(c);
      case "location":
        return checkLocation(c, hass);
      case "view_columns":
        return true;
      case "and":
        return !c.conditions || checkConditionsMet(c.conditions, hass, entityId);
      case "not":
        return !c.conditions || !checkConditionsMet(c.conditions, hass, entityId);
      case "or":
        return (
          !c.conditions ||
          c.conditions.some((sub: Condition) => checkConditionsMet([sub], hass, entityId))
        );
      default:
        return checkState(c, hass, entityId);
    }
  });

/** Whether any (nested) condition uses one of the given types. */
export const usesCondition = (conditions: Condition[] | undefined, types: string[]): boolean =>
  !!conditions?.some(
    (c) => types.includes(c.condition) || usesCondition(c.conditions, types)
  );
