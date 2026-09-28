// Port of the frontend's state coloring (common/entity/state_color.ts,
// state_active.ts, color/compute-color.ts) so segments are colored exactly
// like the native button card.
import type { HassEntity } from "./types";

const STATE_COLORED_DOMAIN = new Set([
  "alarm_control_panel",
  "alert",
  "automation",
  "binary_sensor",
  "calendar",
  "camera",
  "climate",
  "cover",
  "device_tracker",
  "fan",
  "group",
  "humidifier",
  "input_boolean",
  "lawn_mower",
  "light",
  "lock",
  "media_player",
  "person",
  "plant",
  "remote",
  "schedule",
  "script",
  "siren",
  "sun",
  "switch",
  "timer",
  "update",
  "vacuum",
  "valve",
  "water_heater",
  "weather",
]);

const TIMESTAMP_STATE_DOMAINS = new Set(["button", "event", "input_button", "scene"]);

const THEME_COLORS = new Set([
  "primary",
  "accent",
  "red",
  "pink",
  "purple",
  "deep-purple",
  "indigo",
  "blue",
  "light-blue",
  "cyan",
  "teal",
  "green",
  "light-green",
  "lime",
  "yellow",
  "amber",
  "orange",
  "deep-orange",
  "brown",
  "light-grey",
  "grey",
  "dark-grey",
  "blue-grey",
  "black",
  "white",
  "primary-text",
  "secondary-text",
  "disabled",
]);

const CLIMATE_HVAC_ACTION_TO_MODE: Record<string, string> = {
  cooling: "cool",
  defrosting: "heat",
  drying: "dry",
  fan: "fan_only",
  heating: "heat",
  idle: "off",
  off: "off",
  preheating: "heat",
};

const computeDomain = (entityId: string) => entityId.split(".")[0];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Theme color name (`amber`, `primary`) → CSS variable, anything else as-is. */
export const computeCssColor = (color: string): string =>
  THEME_COLORS.has(color) ? `var(--${color}-color)` : color;

export const stateActive = (stateObj: HassEntity, state?: string): boolean => {
  const domain = computeDomain(stateObj.entity_id);
  const compareState = state ?? stateObj.state;

  if (TIMESTAMP_STATE_DOMAINS.has(domain)) return compareState !== "unavailable";
  if (compareState === "unavailable" || compareState === "unknown") return false;
  if (compareState === "off" && domain !== "alert") return false;

  switch (domain) {
    case "alarm_control_panel":
      return compareState !== "disarmed";
    case "alert":
      return compareState !== "idle";
    case "cover":
    case "valve":
      return compareState !== "closed";
    case "device_tracker":
    case "person":
      return compareState !== "not_home";
    case "lawn_mower":
      return !["docked", "paused", "idle"].includes(compareState);
    case "lock":
      return compareState !== "locked";
    case "media_player":
      return compareState !== "standby";
    case "vacuum":
      return !["idle", "docked", "paused"].includes(compareState);
    case "plant":
      return compareState === "problem";
    case "group":
      return ["on", "home", "open", "locked", "problem"].includes(compareState);
    case "timer":
      return compareState === "active";
    case "camera":
      return ["streaming", "recording"].includes(compareState);
  }
  return true;
};

const groupDomain = (stateObj: HassEntity): string | undefined => {
  const ids: string[] = stateObj.attributes.entity_id ?? [];
  const domains = new Set(ids.map(computeDomain));
  return domains.size === 1 ? [...domains][0] : undefined;
};

const stateColorCss = (stateObj: HassEntity, state?: string): string | undefined => {
  const compareState = state ?? stateObj.state;
  if (compareState === "unavailable") return "var(--state-unavailable-color)";

  let domain = computeDomain(stateObj.entity_id);
  if (domain === "group") {
    const inner = groupDomain(stateObj);
    if (inner && STATE_COLORED_DOMAIN.has(inner)) domain = inner;
  }
  if (!STATE_COLORED_DOMAIN.has(domain)) return undefined;

  const stateKey = slugify(compareState);
  const activeKey = stateActive(stateObj, state) ? "active" : "inactive";
  const deviceClass = stateObj.attributes.device_class;
  const properties = [
    ...(deviceClass ? [`--state-${domain}-${deviceClass}-${stateKey}-color`] : []),
    `--state-${domain}-${stateKey}-color`,
    `--state-${domain}-${activeKey}-color`,
    `--state-${activeKey}-color`,
  ];
  return properties.reduceRight(
    (fallback, prop) => (fallback ? `var(${prop}, ${fallback})` : `var(${prop})`),
    ""
  );
};

/** Color for an entity's icon, mirroring hui-button-card's _computeColor. */
export const computeStateColor = (
  stateObj: HassEntity | undefined,
  color?: string
): string | undefined => {
  if (color) {
    return !stateObj || stateActive(stateObj) ? computeCssColor(color) : undefined;
  }
  if (!stateObj) return undefined;

  if (stateObj.attributes.rgb_color) {
    return `rgb(${stateObj.attributes.rgb_color.join(",")})`;
  }
  const hvacAction = stateObj.attributes.hvac_action;
  if (hvacAction) {
    return hvacAction in CLIMATE_HVAC_ACTION_TO_MODE
      ? stateColorCss(stateObj, CLIMATE_HVAC_ACTION_TO_MODE[hvacAction])
      : undefined;
  }
  return stateColorCss(stateObj);
};

/** Dims the icon of dimmed lights, like the native button card. */
export const stateColorBrightness = (stateObj: HassEntity): string | undefined => {
  const brightness = stateObj.attributes.brightness;
  if (brightness && computeDomain(stateObj.entity_id) !== "plant") {
    return `brightness(${(brightness + 245) / 5}%)`;
  }
  return undefined;
};
