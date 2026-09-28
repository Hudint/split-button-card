import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { defaultTapAction } from "./split-button-segment";
import type {
  DividerMode,
  HomeAssistant,
  SegmentConfig,
  SplitButtonCardConfig,
} from "./types";

const CARD_VERSION = "0.1.0";

const DIVIDER_MODES: DividerMode[] = ["border", "line", "gap", "none"];

// Card border as drawn by ha-card, reused for the "border" divider.
const CARD_BORDER_WIDTH = "var(--ha-card-border-width, 1px)";
const CARD_BORDER_COLOR = "var(--ha-card-border-color, var(--divider-color, #e0e0e0))";

@customElement("split-button-card")
export class SplitButtonCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: SplitButtonCardConfig;

  @state() private _segments: SegmentConfig[] = [];

  public static getStubConfig(hass: HomeAssistant): SplitButtonCardConfig {
    const lights = Object.keys(hass.states)
      .filter((id) => id.startsWith("light.") || id.startsWith("switch."))
      .slice(0, 2);
    return {
      type: "custom:split-button-card",
      buttons: lights.length
        ? lights.map((entity) => ({ entity }))
        : [
            { name: "Left", icon: "mdi:arrow-left" },
            { name: "Right", icon: "mdi:arrow-right" },
          ],
    };
  }

  public setConfig(config: SplitButtonCardConfig): void {
    if (!config || !Array.isArray(config.buttons) || !config.buttons.length) {
      throw new Error("You need to define at least one entry in 'buttons'");
    }
    if (config.divider && !DIVIDER_MODES.includes(config.divider)) {
      throw new Error(
        `Invalid divider '${config.divider}', use one of: ${DIVIDER_MODES.join(", ")}`
      );
    }
    if (
      config.columns !== undefined &&
      (!Number.isInteger(config.columns) || config.columns < 1)
    ) {
      throw new Error("'columns' must be a positive integer");
    }
    config.buttons.forEach((button, i) => {
      if (!button || typeof button !== "object") {
        throw new Error(`buttons[${i}] must be an object`);
      }
      if (button.entity && !/^\w+\.\w+$/.test(button.entity)) {
        throw new Error(`buttons[${i}]: invalid entity '${button.entity}'`);
      }
    });

    this._config = config;
    // Card-level options act as defaults for every segment.
    this._segments = config.buttons.map((button) => ({
      show_icon: config.show_icon ?? true,
      show_name: config.show_name ?? true,
      show_state: config.show_state ?? false,
      icon_height: config.icon_height,
      tap_action: defaultTapAction(button.entity),
      hold_action: { action: "more-info" },
      double_tap_action: { action: "none" },
      ...button,
    }));
  }

  private get _columns(): number {
    return this._config?.columns ?? this._segments.length;
  }

  private get _rows(): number {
    return Math.ceil(this._segments.length / this._columns);
  }

  public getCardSize(): number {
    return this._rows * 3;
  }

  public getGridOptions() {
    return {
      columns: 12,
      rows: this._rows * 2,
      min_columns: 3,
      min_rows: this._rows,
    };
  }

  protected render() {
    if (!this._config) return nothing;

    const config = this._config;
    const divider = config.divider ?? "border";
    const gap = config.gap ?? "8px";

    const vars: Record<string, string> = {
      "--sbc-columns": String(this._columns),
    };
    if (divider === "border" || divider === "line") {
      vars["--sbc-divider-display"] = "block";
      vars["--sbc-divider-width"] =
        config.divider_width ?? (divider === "border" ? CARD_BORDER_WIDTH : "1px");
      vars["--sbc-divider-color"] =
        config.divider_color ??
        (divider === "border" ? CARD_BORDER_COLOR : "var(--divider-color, #e0e0e0)");
      vars["--sbc-divider-inset"] = divider === "line" ? "20%" : "0px";
    } else if (divider === "gap") {
      vars["--sbc-gap"] = gap;
      vars["--sbc-segment-border"] = `${config.divider_width ?? CARD_BORDER_WIDTH} solid ${
        config.divider_color ?? CARD_BORDER_COLOR
      }`;
      vars["--sbc-segment-radius"] = `max(0px, calc(var(--ha-card-border-radius, 12px) - ${gap}))`;
    }

    return html`
      <ha-card class=${`divider-${divider}`} style=${styleMap(vars)}>
        <div class="grid">
          ${this._segments.map(
            (segment) => html`
              <split-button-segment
                .hass=${this.hass}
                .config=${segment}
              ></split-button-segment>
            `
          )}
        </div>
      </ha-card>
    `;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    ha-card {
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(var(--sbc-columns), minmax(0, 1fr));
      grid-auto-rows: 1fr;
      height: 100%;
      box-sizing: border-box;
    }

    /* Grow the grid by one divider width to the right and bottom so the
       dividers on the outer edges fall outside the (clipping) card. */
    .divider-border .grid,
    .divider-line .grid {
      height: calc(100% + var(--sbc-divider-width));
      margin-right: calc(-1 * var(--sbc-divider-width));
      margin-bottom: calc(-1 * var(--sbc-divider-width));
    }

    .divider-gap .grid {
      gap: var(--sbc-gap);
      padding: var(--sbc-gap);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "split-button-card": SplitButtonCard;
  }
  interface Window {
    customCards?: Array<Record<string, unknown>>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "split-button-card",
  name: "Split Button Card",
  description: "A button card split into multiple sub-buttons, each with its own icon, name and action.",
  preview: true,
});

console.info(
  `%c SPLIT-BUTTON-CARD %c v${CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: 700;",
  "color: #03a9f4; background: white; font-weight: 700;"
);
