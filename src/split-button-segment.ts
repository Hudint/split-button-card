import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { styleMap } from "lit/directives/style-map.js";
import type { ActionConfig, HomeAssistant, SegmentConfig } from "./types";

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

  // Only re-render when the entity this segment shows actually changed.
  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (changed.size !== 1 || !changed.has("hass")) return true;
    const entity = this.config?.entity;
    if (!entity) return false;
    const oldHass = changed.get("hass") as HomeAssistant | undefined;
    return oldHass?.states[entity] !== this.hass?.states[entity];
  }

  protected render() {
    const config = this.config;
    if (!config) return nothing;

    const stateObj = config.entity ? this.hass?.states[config.entity] : undefined;
    const name = config.name ?? stateObj?.attributes.friendly_name ?? "";
    const clickable = hasAction(config.tap_action);
    const iconStyle = styleMap({ height: config.icon_height });

    return html`
      <div
        class="segment"
        role="button"
        aria-label=${name}
        tabindex=${ifDefined(clickable ? "0" : undefined)}
        @click=${this._handleTap}
        @keydown=${this._handleKeyDown}
      >
        <ha-ripple .disabled=${!clickable}></ha-ripple>
        ${config.show_icon
          ? stateObj
            ? html`<ha-state-icon
                class="icon"
                .hass=${this.hass}
                .stateObj=${stateObj}
                .icon=${config.icon}
                style=${iconStyle}
              ></ha-state-icon>`
            : html`<ha-icon
                class="icon"
                .icon=${config.icon}
                style=${iconStyle}
              ></ha-icon>`
          : nothing}
        ${config.show_name ? html`<span .title=${name}>${name}</span>` : nothing}
        ${config.show_state && stateObj
          ? html`<span class="state">
              ${this.hass?.formatEntityState?.(stateObj) ?? stateObj.state}
            </span>`
          : nothing}
      </div>
      <div class="divider right"></div>
      <div class="divider bottom"></div>
    `;
  }

  private _handleTap(): void {
    if (!hasAction(this.config.tap_action)) return;
    this.dispatchEvent(
      new CustomEvent("hass-action", {
        bubbles: true,
        composed: true,
        detail: { config: this.config, action: "tap" },
      })
    );
  }

  private _handleKeyDown(ev: KeyboardEvent): void {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    this._handleTap();
  }

  static styles = css`
    :host {
      display: block;
      position: relative;
      min-width: 0;
      min-height: 0;
    }

    .segment {
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
    }

    .segment:not([tabindex]) {
      cursor: default;
    }

    .segment:focus-visible {
      box-shadow: inset 0 0 0 2px var(--state-color);
    }

    .icon {
      width: 40%;
      height: auto;
      max-height: 80%;
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

    span {
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .state {
      font-size: 0.9rem;
      color: var(--secondary-text-color);
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
