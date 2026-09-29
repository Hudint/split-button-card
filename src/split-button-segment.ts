import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { styleMap } from "lit/directives/style-map.js";
import { ActionHandler, type Action } from "./action-handler";
import { computeStateColor, stateActive, stateColorBrightness } from "./state-color";
import { isTemplate, renderTemplate } from "./templates";
import type { ActionConfig, HassEntity, HomeAssistant, SegmentConfig } from "./types";

// Domains the native button card toggles on tap (frontend DOMAINS_TOGGLE).
const DOMAINS_TOGGLE = new Set([
  "fan",
  "input_boolean",
  "light",
  "switch",
  "group",
  "automation",
  "humidifier",
  "valve",
]);

export const ANIMATIONS = ["bounce", "pulse", "shake", "blink"] as const;

// Options that may be button-card style JavaScript templates.
const TEMPLATE_KEYS = ["name", "icon", "color", "entity_picture", "state_display"] as const;

const hasAction = (config?: ActionConfig) =>
  config !== undefined && config.action !== "none";

export const defaultTapAction = (entity?: string): ActionConfig => {
  if (!entity) return { action: "none" };
  return {
    action: DOMAINS_TOGGLE.has(entity.split(".")[0]) ? "toggle" : "more-info",
  };
};

@customElement("split-button-segment")
export class SplitButtonSegment extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public config!: SegmentConfig;

  /** Hidden by its visibility conditions, but shown while editing. */
  @property({ type: Boolean, reflect: true }) public dimmed = false;

  private _actionHandler?: ActionHandler;

  // Only re-render when the entity this segment shows actually changed.
  // Templates can read any entity, so segments using them always update.
  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (changed.size !== 1 || !changed.has("hass")) return true;
    if (TEMPLATE_KEYS.some((key) => isTemplate(this.config?.[key]))) return true;
    const entity = this.config?.entity;
    if (!entity) return false;
    const oldHass = changed.get("hass") as HomeAssistant | undefined;
    return oldHass?.states[entity] !== this.hass?.states[entity];
  }

  protected render() {
    if (!this.config) return nothing;

    const stateObj = this.config.entity ? this.hass?.states[this.config.entity] : undefined;
    const config = this._resolveTemplates(stateObj);
    const name = this._computeName(config.name, stateObj);
    const clickable = hasAction(config.tap_action);

    // Same rules as the native button: "state" is the default coloring,
    // "none" (or state_color: false without a color) disables it.
    const color = config.color === "state" ? undefined : config.color;
    const noColor = color === "none" || (!color && config.state_color === false);
    const iconColor = noColor ? undefined : computeStateColor(stateObj, color);
    const backgroundColor =
      config.state_background &&
      color !== "none" &&
      (!stateObj || stateActive(stateObj))
        ? computeStateColor(stateObj, color)
        : undefined;

    const picture =
      config.entity_picture ||
      (config.show_entity_picture ? stateObj?.attributes.entity_picture : undefined);

    const stateText =
      config.state_display !== undefined && config.state_display !== null
        ? String(config.state_display)
        : stateObj
          ? (this.hass?.formatEntityState?.(stateObj) ?? stateObj.state)
          : undefined;

    const iconStyle = styleMap({
      height: config.icon_height,
      filter: stateObj && iconColor && !picture ? stateColorBrightness(stateObj) : undefined,
    });

    return html`
      <div
        class="segment ${config.animation ? `animate-${config.animation}` : ""}"
        role="button"
        aria-label=${name}
        tabindex=${ifDefined(clickable ? "0" : undefined)}
        style=${styleMap({
          "--state-color": iconColor,
          "--sbc-background-color": backgroundColor,
          "--sbc-background-opacity":
            config.background_opacity !== undefined
              ? String(config.background_opacity)
              : undefined,
        })}
      >
        ${backgroundColor ? html`<div class="background"></div>` : nothing}
        <ha-ripple .disabled=${!clickable}></ha-ripple>
        ${config.show_icon ? this._renderIcon(config, stateObj, picture, iconStyle) : nothing}
        ${config.show_name ? html`<span class="name" .title=${name}>${name}</span>` : nothing}
        ${config.show_state && stateText !== undefined
          ? html`<span class="state">${stateText}</span>`
          : nothing}
      </div>
      <div class="divider right"></div>
      <div class="divider bottom"></div>
    `;
  }

  private _renderIcon(
    config: SegmentConfig,
    stateObj: HassEntity | undefined,
    picture: string | undefined,
    iconStyle: ReturnType<typeof styleMap>
  ) {
    if (picture) {
      return html`<img class="icon picture" src=${picture} alt="" style=${iconStyle} />`;
    }
    if (stateObj) {
      return html`<ha-state-icon
        class="icon"
        .hass=${this.hass}
        .stateObj=${stateObj}
        .icon=${config.icon}
        style=${iconStyle}
      ></ha-state-icon>`;
    }
    return html`<ha-icon class="icon" .icon=${config.icon} style=${iconStyle}></ha-icon>`;
  }

  /** Config with all JavaScript templates replaced by their result. */
  private _resolveTemplates(stateObj?: HassEntity): SegmentConfig {
    const config: SegmentConfig = { ...this.config };
    for (const key of TEMPLATE_KEYS) {
      if (isTemplate(config[key])) {
        (config as any)[key] = renderTemplate(config[key], this.hass, stateObj) ?? undefined;
      }
    }
    return config;
  }

  private _computeName(name: SegmentConfig["name"], stateObj?: HassEntity): string {
    if (stateObj && this.hass?.formatEntityName) {
      return this.hass.formatEntityName(stateObj, name);
    }
    if (typeof name === "string") return name;
    return stateObj?.attributes.friendly_name ?? "";
  }

  protected updated(): void {
    const segment = this.renderRoot.querySelector<HTMLElement>(".segment");
    if (!segment) return;
    if (!this._actionHandler) {
      this._actionHandler = new ActionHandler(segment, (action) =>
        this._handleAction(action)
      );
    }
    this._actionHandler.options = {
      hasHold: hasAction(this.config.hold_action),
      hasDoubleClick: hasAction(this.config.double_tap_action),
    };
  }

  private _handleAction(action: Action): void {
    const actionConfig = this.config[`${action}_action`];
    if (!hasAction(actionConfig)) return;
    this.dispatchEvent(
      new CustomEvent("hass-action", {
        bubbles: true,
        composed: true,
        detail: { config: this.config, action },
      })
    );
  }

  static styles = css`
    :host {
      display: block;
      position: relative;
      min-width: 0;
      min-height: 0;
    }

    .segment {
      --state-inactive-color: var(--state-icon-color);
      --state-color: var(--state-icon-color);
      --ha-ripple-color: var(--state-color);
      --ha-ripple-hover-opacity: 0.04;
      --ha-ripple-pressed-opacity: 0.12;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 4% 4px;
      height: 100%;
      box-sizing: border-box;
      font-size: var(--ha-font-size-l, 16.8px);
      line-height: var(--ha-line-height-condensed, 1.2);
      border-radius: var(--sbc-segment-radius, 0);
      border: var(--sbc-segment-border, none);
      cursor: pointer;
      outline: none;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }

    .segment:not([tabindex]) {
      cursor: default;
    }

    .background {
      position: absolute;
      inset: 0;
      background: var(--sbc-background-color);
      opacity: var(--sbc-background-opacity, 0.2);
      pointer-events: none;
      transition: background-color 180ms ease-in-out;
    }

    .segment:focus-visible {
      box-shadow: inset 0 0 0 2px var(--state-color);
    }

    /* Keep content above the absolutely positioned background layer. */
    .icon,
    span {
      position: relative;
    }

    .icon {
      width: 40%;
      height: auto;
      max-height: 80%;
      min-height: 0;
      color: var(--state-color);
      --mdc-icon-size: 100%;
      transition: transform 180ms ease-in-out;
      pointer-events: none;
    }

    .segment:focus-visible .icon,
    .segment:active .icon {
      transform: scale(1.2);
    }

    .icon + span {
      margin-top: 8px;
    }

    .picture {
      object-fit: contain;
    }

    .picture[style*="height"] {
      width: auto;
      max-width: 90%;
    }

    .name {
      font-size: var(--sbc-name-font-size, inherit);
      font-weight: var(--sbc-name-font-weight, inherit);
    }

    span {
      flex-shrink: 0;
      max-width: 100%;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      hyphens: auto;
      overflow-wrap: break-word;
    }

    .state {
      -webkit-line-clamp: 1;
      font-size: var(--sbc-state-font-size, 0.9rem);
      font-weight: var(--sbc-state-font-weight, inherit);
      color: var(--secondary-text-color);
    }

    .animate-bounce .icon {
      animation: sbc-bounce 2s ease-in-out infinite;
    }

    .animate-pulse .icon {
      animation: sbc-pulse 1.5s ease-in-out infinite;
    }

    .animate-shake .icon {
      animation: sbc-shake 1.2s ease-in-out infinite;
    }

    .animate-blink > :not(.background, ha-ripple) {
      animation: sbc-blink 1.5s ease-in-out infinite;
    }

    @keyframes sbc-bounce {
      0%,
      100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-15%);
      }
    }

    @keyframes sbc-pulse {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.15);
      }
    }

    @keyframes sbc-shake {
      0%,
      50%,
      100% {
        transform: rotate(0);
      }
      10%,
      30% {
        transform: rotate(-12deg);
      }
      20%,
      40% {
        transform: rotate(12deg);
      }
    }

    @keyframes sbc-blink {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.35;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .segment .icon,
      .segment > * {
        animation: none !important;
      }
    }

    :host([dimmed]) .segment {
      opacity: 0.4;
    }

    /* Dividers sit on the right/bottom edge of every segment. The card
       extends the grid by one divider width so the outermost ones are
       clipped away, leaving lines only between segments. */
    .divider {
      display: var(--sbc-divider-display, none);
      position: absolute;
      background: var(--sbc-divider-color);
      pointer-events: none;
    }

    .divider.right {
      top: var(--sbc-divider-inset, 0);
      bottom: var(--sbc-divider-inset, 0);
      right: 0;
      width: var(--sbc-divider-width);
    }

    .divider.bottom {
      left: var(--sbc-divider-inset, 0);
      right: var(--sbc-divider-inset, 0);
      bottom: 0;
      height: var(--sbc-divider-width);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "split-button-segment": SplitButtonSegment;
  }
}
