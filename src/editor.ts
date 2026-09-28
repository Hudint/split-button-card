import {
  mdiArrowDown,
  mdiArrowUp,
  mdiContentCopy,
  mdiDelete,
  mdiGestureTap,
  mdiPalette,
  mdiPlus,
} from "@mdi/js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { defaultTapAction } from "./split-button-segment";
import type { HomeAssistant, SegmentConfig, SplitButtonCardConfig } from "./types";

// Labels for options the frontend has no translation for.
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    columns: "Columns",
    divider: "Divider",
    divider_border: "Card border",
    divider_line: "Short lines",
    divider_gap: "Separate tiles",
    divider_none: "None",
    divider_width: "Divider width",
    divider_color: "Divider color",
    gap: "Gap",
    appearance: "Appearance (defaults for all buttons)",
    state_background: "Tint background when active",
    background_opacity: "Background opacity",
    span: "Column span",
    row_span: "Row span",
    buttons: "Buttons",
    add_button: "Add button",
    move_up: "Move up",
    move_down: "Move down",
    duplicate: "Duplicate",
    remove: "Remove",
    button: "Button",
  },
  de: {
    columns: "Spalten",
    divider: "Trennung",
    divider_border: "Kartenrahmen",
    divider_line: "Kurze Linien",
    divider_gap: "Einzelne Kacheln",
    divider_none: "Keine",
    divider_width: "Linienbreite",
    divider_color: "Linienfarbe",
    gap: "Abstand",
    appearance: "Darstellung (Standard für alle Buttons)",
    state_background: "Hintergrund einfärben, wenn aktiv",
    background_opacity: "Deckkraft des Hintergrunds",
    span: "Spaltenbreite",
    row_span: "Zeilenhöhe",
    buttons: "Buttons",
    add_button: "Button hinzufügen",
    move_up: "Nach oben",
    move_down: "Nach unten",
    duplicate: "Duplizieren",
    remove: "Entfernen",
    button: "Button",
  },
};

// Keys the frontend already translates under ui.panel.lovelace.editor.card.generic.
const GENERIC_KEYS = new Set([
  "entity",
  "name",
  "icon",
  "icon_height",
  "color",
  "show_name",
  "show_state",
  "show_icon",
  "tap_action",
  "hold_action",
  "double_tap_action",
  "interactions",
]);

const ACTION_RELATED_CONTEXT = { entity_id: "entity", area_id: "area" };

// Defaults ha-form shows as values; they are only written to the config
// when the user actually changes them.
const CARD_DEFAULTS: Record<string, unknown> = {
  divider: "border",
  show_name: true,
  show_icon: true,
  show_state: false,
  state_background: false,
  background_opacity: 0.2,
};

const colorSchema = [
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "color",
        selector: {
          ui_color: { default_color: "state", include_state: true, include_none: true },
        },
      },
      { name: "state_background", selector: { boolean: {} } },
    ],
  },
  {
    name: "background_opacity",
    selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } },
  },
];

let formLoaded: Promise<void> | undefined;

/**
 * ha-form and its selectors are lazy-loaded by the frontend. Loading the
 * native button card editor pulls in everything this editor needs.
 */
export const loadHaForm = (): Promise<void> => {
  formLoaded ??= (async () => {
    if (customElements.get("hui-button-card-editor")) return;
    const helpers = await (window as any).loadCardHelpers?.();
    const card = await helpers?.createCardElement({ type: "button" });
    await card?.constructor?.getConfigElement?.();
  })().catch(() => undefined);
  return formLoaded;
};

const atLeast = (version: string | undefined, year: number, month: number) => {
  const [y, m] = (version ?? "").split(".").map(Number);
  return y > year || (y === year && m >= month);
};

@customElement("split-button-card-editor")
export class SplitButtonCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: SplitButtonCardConfig;

  @state() private _expanded?: number;

  public setConfig(config: SplitButtonCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    const lang = (this.hass?.locale?.language ?? this.hass?.language ?? "en").split("-")[0];
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  }

  private _cardSchema() {
    return [
      {
        name: "",
        type: "grid",
        schema: [
          { name: "columns", selector: { number: { min: 1, max: 12, mode: "box" } } },
          {
            name: "divider",
            selector: {
              select: {
                mode: "dropdown",
                options: ["border", "line", "gap", "none"].map((value) => ({
                  value,
                  label: this._t(`divider_${value}`),
                })),
              },
            },
          },
          { name: "divider_width", selector: { text: {} } },
          { name: "divider_color", selector: { text: {} } },
          ...(this._config?.divider === "gap"
            ? [{ name: "gap", selector: { text: {} } }]
            : []),
        ],
      },
      {
        name: "appearance",
        type: "expandable",
        flatten: true,
        iconPath: mdiPalette,
        schema: [
          {
            name: "",
            type: "grid",
            column_min_width: "100px",
            schema: [
              { name: "show_name", selector: { boolean: {} } },
              { name: "show_state", selector: { boolean: {} } },
              { name: "show_icon", selector: { boolean: {} } },
            ],
          },
          ...colorSchema,
        ],
      },
    ];
  }

  private _buttonSchema(button: SegmentConfig) {
    const columns = this._config?.columns ?? this._config?.buttons.length ?? 1;
    // The entity_name selector exists since the 2025.12 entity naming changes
    // and only makes sense when there is an entity to compose a name from.
    const nameSelector =
      button.entity && atLeast(this.hass?.config?.version, 2025, 12)
      ? { selector: { entity_name: {} }, context: { entity: "entity" } }
      : { selector: { text: {} } };
    return [
      { name: "entity", selector: { entity: {} } },
      { name: "name", ...nameSelector },
      {
        name: "",
        type: "grid",
        schema: [
          { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } },
          { name: "icon_height", selector: { text: { suffix: "px" } } },
        ],
      },
      {
        name: "",
        type: "grid",
        column_min_width: "100px",
        schema: [
          { name: "show_name", selector: { boolean: {} } },
          { name: "show_state", selector: { boolean: {} } },
          { name: "show_icon", selector: { boolean: {} } },
        ],
      },
      ...colorSchema,
      {
        name: "",
        type: "grid",
        schema: [
          { name: "span", selector: { number: { min: 1, max: columns, mode: "box" } } },
          { name: "row_span", selector: { number: { min: 1, max: 12, mode: "box" } } },
        ],
      },
      {
        name: "interactions",
        type: "expandable",
        flatten: true,
        iconPath: mdiGestureTap,
        schema: [
          {
            name: "tap_action",
            selector: { ui_action: { default_action: defaultTapAction(button.entity).action } },
            context: ACTION_RELATED_CONTEXT,
          },
          {
            name: "hold_action",
            selector: { ui_action: { default_action: "more-info" } },
            context: ACTION_RELATED_CONTEXT,
          },
          {
            name: "",
            type: "optional_actions",
            flatten: true,
            schema: [
              {
                name: "double_tap_action",
                selector: { ui_action: { default_action: "none" } },
                context: ACTION_RELATED_CONTEXT,
              },
            ],
          },
        ],
      },
    ];
  }

  /** Values a button inherits from the card, shown as its form defaults. */
  private _buttonDefaults(): Record<string, unknown> {
    const config = this._config!;
    return {
      show_name: config.show_name ?? CARD_DEFAULTS.show_name,
      show_icon: config.show_icon ?? CARD_DEFAULTS.show_icon,
      show_state: config.show_state ?? CARD_DEFAULTS.show_state,
      state_background: config.state_background ?? CARD_DEFAULTS.state_background,
      background_opacity: config.background_opacity ?? CARD_DEFAULTS.background_opacity,
    };
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const buttons = this._config.buttons ?? [];

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${withDefaults(this._config, CARD_DEFAULTS)}
        .schema=${this._cardSchema()}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._cardChanged}
      ></ha-form>

      <div class="buttons">
        <h3>${this._t("buttons")}</h3>
        ${buttons.map((button, index) => this._renderButton(button, index, buttons.length))}
        <ha-button appearance="filled" @click=${this._addButton}>
          <ha-svg-icon slot="start" .path=${mdiPlus}></ha-svg-icon>
          ${this._t("add_button")}
        </ha-button>
      </div>
    `;
  }

  private _renderButton(button: SegmentConfig, index: number, count: number) {
    const stateObj = button.entity ? this.hass!.states[button.entity] : undefined;
    const name =
      typeof button.name === "string"
        ? button.name
        : stateObj && this.hass!.formatEntityName
          ? this.hass!.formatEntityName(stateObj, button.name)
          : stateObj?.attributes.friendly_name;
    const data = withDefaults(button, this._buttonDefaults());
    if (typeof data.icon_height === "string" && data.icon_height.endsWith("px")) {
      data.icon_height = String(parseFloat(data.icon_height));
    }

    return html`
      <ha-expansion-panel
        outlined
        left-chevron
        .expanded=${this._expanded === index}
        .header=${name || `${this._t("button")} ${index + 1}`}
        .secondary=${button.entity ?? ""}
        @expanded-changed=${(ev: CustomEvent) => this._expandedChanged(ev, index)}
      >
        ${stateObj
          ? html`<ha-state-icon
              slot="leading-icon"
              .hass=${this.hass}
              .stateObj=${stateObj}
              .icon=${button.icon}
            ></ha-state-icon>`
          : html`<ha-icon slot="leading-icon" .icon=${button.icon ?? "mdi:gesture-tap-button"}></ha-icon>`}
        <div slot="icons" class="actions" @click=${stopPropagation}>
          <ha-icon-button
            .label=${this._t("move_up")}
            .path=${mdiArrowUp}
            .disabled=${index === 0}
            @click=${() => this._moveButton(index, -1)}
          ></ha-icon-button>
          <ha-icon-button
            .label=${this._t("move_down")}
            .path=${mdiArrowDown}
            .disabled=${index === count - 1}
            @click=${() => this._moveButton(index, 1)}
          ></ha-icon-button>
          <ha-icon-button
            .label=${this._t("duplicate")}
            .path=${mdiContentCopy}
            @click=${() => this._duplicateButton(index)}
          ></ha-icon-button>
          <ha-icon-button
            .label=${this._t("remove")}
            .path=${mdiDelete}
            .disabled=${count === 1}
            @click=${() => this._removeButton(index)}
          ></ha-icon-button>
        </div>
        <ha-form
          .hass=${this.hass}
          .data=${data}
          .schema=${this._buttonSchema(button)}
          .computeLabel=${this._computeLabel}
          .computeHelper=${this._computeHelper}
          @value-changed=${(ev: CustomEvent) => this._buttonChanged(ev, index)}
        ></ha-form>
      </ha-expansion-panel>
    `;
  }

  private _computeLabel = (schema: { name: string }): string => {
    if (GENERIC_KEYS.has(schema.name)) {
      const label = this.hass!.localize?.(`ui.panel.lovelace.editor.card.generic.${schema.name}`);
      if (label) return label;
    }
    return this._t(schema.name);
  };

  private _computeHelper = (schema: { name: string }): string | undefined =>
    schema.name === "tap_action" || schema.name === "hold_action"
      ? this.hass!.localize?.("ui.panel.lovelace.editor.card.button.default_action_help")
      : undefined;

  private _expandedChanged(ev: CustomEvent, index: number): void {
    if (ev.detail.expanded) {
      this._expanded = index;
    } else if (this._expanded === index) {
      this._expanded = undefined;
    }
  }

  private _cardChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const value = stripDefaults(ev.detail.value, this._config!, CARD_DEFAULTS);
    this._updateConfig(value as SplitButtonCardConfig);
  }

  private _buttonChanged(ev: CustomEvent, index: number): void {
    ev.stopPropagation();
    const buttons = [...this._config!.buttons];
    const value = stripDefaults(ev.detail.value, buttons[index], this._buttonDefaults());
    if (value.icon_height && !String(value.icon_height).endsWith("px")) {
      value.icon_height = `${value.icon_height}px`;
    }
    buttons[index] = value as SegmentConfig;
    this._updateConfig({ ...this._config!, buttons });
  }

  private _addButton(): void {
    const buttons = [...(this._config!.buttons ?? []), { icon: "mdi:gesture-tap-button" }];
    this._expanded = buttons.length - 1;
    this._updateConfig({ ...this._config!, buttons });
  }

  private _duplicateButton(index: number): void {
    const buttons = [...this._config!.buttons];
    buttons.splice(index + 1, 0, structuredClone(buttons[index]));
    this._expanded = index + 1;
    this._updateConfig({ ...this._config!, buttons });
  }

  private _removeButton(index: number): void {
    const buttons = this._config!.buttons.filter((_, i) => i !== index);
    this._expanded = undefined;
    this._updateConfig({ ...this._config!, buttons });
  }

  private _moveButton(index: number, offset: number): void {
    const buttons = [...this._config!.buttons];
    const [moved] = buttons.splice(index, 1);
    buttons.splice(index + offset, 0, moved);
    if (this._expanded === index) this._expanded = index + offset;
    this._updateConfig({ ...this._config!, buttons });
  }

  private _updateConfig(config: SplitButtonCardConfig): void {
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true })
    );
  }

  static styles = css`
    .buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 24px;
    }

    h3 {
      margin: 0 0 4px;
      font-size: var(--ha-font-size-l, 16px);
      font-weight: var(--ha-font-weight-medium, 500);
    }

    ha-expansion-panel {
      --expansion-panel-content-padding: 0 16px;
    }

    ha-expansion-panel[expanded] {
      --expansion-panel-content-padding: 0 16px 16px;
    }

    ha-expansion-panel ha-form {
      display: block;
      padding-top: 8px;
    }

    [slot="leading-icon"] {
      color: var(--secondary-text-color);
    }

    .actions {
      display: flex;
      color: var(--secondary-text-color);
    }

    ha-button {
      align-self: flex-start;
    }
  `;
}

const stopPropagation = (ev: Event) => ev.stopPropagation();

const withDefaults = <T extends object>(config: T, defaults: Record<string, unknown>) =>
  ({ ...defaults, ...config }) as T & Record<string, any>;

/**
 * ha-form reports every displayed value, including defaults we injected.
 * Drop those again unless the user changed them, and drop cleared fields.
 */
const stripDefaults = (
  value: Record<string, any>,
  original: object,
  defaults: Record<string, unknown>
): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val === undefined || val === "") continue;
    if (key in defaults && val === defaults[key] && !(key in original)) continue;
    result[key] = val;
  }
  return result;
};

declare global {
  interface HTMLElementTagNameMap {
    "split-button-card-editor": SplitButtonCardEditor;
  }
}
