import {
  mdiArrowDown,
  mdiArrowUp,
  mdiContentCopy,
  mdiDelete,
  mdiEye,
  mdiFileTree,
  mdiGestureTap,
  mdiPalette,
  mdiPlus,
  mdiMenu,
  mdiTextShort,
  mdiTune,
  mdiViewGrid,
} from "@mdi/js";
import { ContextProvider, createContext } from "@lit/context";
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ANIMATIONS, SWITCH_ANIMATIONS, defaultTapAction } from "./split-button-segment";
import type { HomeAssistant, SegmentConfig, SplitButtonCardConfig } from "./types";

type Path = number[];

// Labels for options the frontend has no translation for.
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    columns: "Columns",
    divider: "Divider",
    divider_border: "Lines",
    divider_line: "Short lines",
    divider_gap: "Separate tiles",
    divider_none: "None",
    divider_width: "Divider width",
    divider_color: "Divider color",
    gap: "Gap",
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
    entity_picture: "Picture URL",
    show_entity_picture: "Show picture",
    state_display: "State text",
    animation: "Animation",
    animation_bounce: "Bounce",
    animation_pulse: "Pulse",
    animation_shake: "Shake",
    animation_blink: "Blink",
    visibility: "Visibility",
    visibility_help: "The button is only shown when all conditions are met.",
    icon_on: "Icon when on",
    icon_off: "Icon when off",
    switch_style: "Switch style (fill when on)",
    switch_animation: "Fill animation",
    switch_left: "Wipe from left",
    switch_bottom: "Wipe from bottom",
    switch_tap: "Circle from tap",
    switch_fade: "Fade",
    switch_text_color: "Icon / text color",
    content: "Content",
    appearance: "Appearance",
    layout: "Layout",
    button_defaults: "Defaults for all buttons",
    active_style: "When on",
    active_icon: "Color the icon",
    active_tint: "Tint the background",
    active_fill: "Fill the button (switch)",
    conditions_count: "conditions",
    condition_count: "condition",
    columns_help: "Default: number of visible buttons",
    state_display_help: "Static text or a JavaScript template [[[ … ]]]",
    entity_picture_help: "Overrides the entity's own picture",
    layout_help: "Number of columns and rows this button occupies",
    show_toggle: "Show switch",
    toggle_color: "Switch color",
    toggle_icon_on: "Switch icon when on",
    toggle_icon_off: "Switch icon when off",
    submenu: "Menu",
    submenu_help: "Tapping the button opens these buttons in its place.",
    menu_open: "Opens with",
    menu_open_tap: "Tap",
    menu_open_hold: "Hold",
    menu_open_double_tap: "Double tap",
    menu_columns: "Columns",
    menu_columns_help: "Default: number of visible buttons",
    menu_close_on_action: "Close after an action",
    menu_settings: "Menus",
    menu_timeout: "Close after inactivity",
    menu_timeout_help: "Seconds, 0 = never",
    menu_back: "Back button",
    menu_back_left: "Strip on the left",
    menu_back_right: "Strip on the right",
    menu_back_top: "Strip at the top",
    menu_back_bottom: "Strip at the bottom",
    menu_back_top_left: "Corner top left",
    menu_back_top_right: "Corner top right",
    menu_back_bottom_left: "Corner bottom left",
    menu_back_bottom_right: "Corner bottom right",
    menu_back_start: "First button",
    menu_back_end: "Last button",
    menu_back_none: "None",
    menu_back_icon: "Back icon",
    menu_back_name: "Back text",
    menu_back_color: "Back color",
    menu_back_size: "Back size",
    menu_back_size_help: "e.g. 40px",
    menu_resize: "Resize the card to the open menu",
    menu_resize_help: "Otherwise the card keeps the size of its largest menu.",
    buttons_count: "buttons",
    button_count: "button",
  },
  de: {
    columns: "Spalten",
    divider: "Trennung",
    divider_border: "Linien",
    divider_line: "Kurze Linien",
    divider_gap: "Einzelne Kacheln",
    divider_none: "Keine",
    divider_width: "Linienbreite",
    divider_color: "Linienfarbe",
    gap: "Abstand",
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
    entity_picture: "Bild-URL",
    show_entity_picture: "Bild anzeigen",
    state_display: "Zustandstext",
    animation: "Animation",
    animation_bounce: "Hüpfen",
    animation_pulse: "Pulsieren",
    animation_shake: "Wackeln",
    animation_blink: "Blinken",
    visibility: "Sichtbarkeit",
    visibility_help: "Der Button wird nur angezeigt, wenn alle Bedingungen erfüllt sind.",
    icon_on: "Icon wenn an",
    icon_off: "Icon wenn aus",
    switch_style: "Schalter-Stil (füllen wenn an)",
    switch_animation: "Füll-Animation",
    switch_left: "Von links wischen",
    switch_bottom: "Von unten wischen",
    switch_tap: "Kreis ab Tipp-Punkt",
    switch_fade: "Einblenden",
    switch_text_color: "Icon-/Textfarbe",
    content: "Inhalt",
    appearance: "Darstellung",
    layout: "Layout",
    button_defaults: "Standards für alle Buttons",
    active_style: "Wenn an",
    active_icon: "Icon färben",
    active_tint: "Hintergrund tönen",
    active_fill: "Button füllen (Schalter)",
    conditions_count: "Bedingungen",
    condition_count: "Bedingung",
    columns_help: "Standard: Anzahl der sichtbaren Buttons",
    state_display_help: "Fester Text oder ein JavaScript-Template [[[ … ]]]",
    entity_picture_help: "Ersetzt das Bild der Entity",
    layout_help: "Anzahl der Spalten und Zeilen, die der Button belegt",
    show_toggle: "Schalter anzeigen",
    toggle_color: "Schalterfarbe",
    toggle_icon_on: "Schalter-Symbol wenn an",
    toggle_icon_off: "Schalter-Symbol wenn aus",
    submenu: "Menü",
    submenu_help: "Ein Tipp auf den Button zeigt an seiner Stelle diese Buttons.",
    menu_open: "Öffnen mit",
    menu_open_tap: "Tippen",
    menu_open_hold: "Halten",
    menu_open_double_tap: "Doppeltippen",
    menu_columns: "Spalten",
    menu_columns_help: "Standard: Anzahl der sichtbaren Buttons",
    menu_close_on_action: "Nach einer Aktion schließen",
    menu_settings: "Menüs",
    menu_timeout: "Schließen nach Inaktivität",
    menu_timeout_help: "Sekunden, 0 = nie",
    menu_back: "Zurück-Button",
    menu_back_left: "Streifen links",
    menu_back_right: "Streifen rechts",
    menu_back_top: "Streifen oben",
    menu_back_bottom: "Streifen unten",
    menu_back_top_left: "Ecke oben links",
    menu_back_top_right: "Ecke oben rechts",
    menu_back_bottom_left: "Ecke unten links",
    menu_back_bottom_right: "Ecke unten rechts",
    menu_back_start: "Als erster Button",
    menu_back_end: "Als letzter Button",
    menu_back_none: "Keiner",
    menu_back_icon: "Zurück-Symbol",
    menu_back_name: "Zurück-Text",
    menu_back_color: "Zurück-Farbe",
    menu_back_size: "Zurück-Größe",
    menu_back_size_help: "z. B. 40px",
    menu_resize: "Kartengröße an das offene Menü anpassen",
    menu_resize_help: "Sonst behält die Karte die Größe ihres größten Menüs.",
    buttons_count: "Buttons",
    button_count: "Button",
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
  show_entity_picture: false,
  switch_style: false,
  show_toggle: false,
  menu_timeout: 15,
  menu_back: "left",
  menu_resize: false,
  menu_close_on_action: true,
};

type ActiveStyle = "icon" | "tint" | "fill";

// "When on" is one choice in the editor, stored as two flags in the config.
const activeStyle = (data: Record<string, unknown>): ActiveStyle =>
  data.switch_style ? "fill" : data.state_background ? "tint" : "icon";

const applyActiveStyle = (
  value: Record<string, any>,
  inherited: Record<string, unknown>
): Record<string, any> => {
  const style = value.active_style as ActiveStyle | undefined;
  const result = { ...value };
  delete result.active_style;
  if (!style) return result;
  const flags = { switch_style: style === "fill", state_background: style === "tint" };
  for (const [key, flag] of Object.entries(flags)) {
    // Only store what differs from the inherited default.
    if (flag === (inherited[key] ?? false)) delete result[key];
    else result[key] = flag;
  }
  return result;
};

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

  /** Path of the deepest expanded button panel, e.g. "0" or "0.2". */
  @state() private _expanded?: string;

  public setConfig(config: SplitButtonCardConfig): void {
    // Keep unchanged parts as the same objects: card-mod hands every editor
    // a JSON copy of its config, and the frontend's conditions editor keys
    // its rows by object identity, so copies would collapse them on every
    // keystroke.
    this._config = reuseEqual(this._config, config);
  }

  private _t(key: string): string {
    const lang = (this.hass?.locale?.language ?? this.hass?.language ?? "en").split("-")[0];
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  }

  private _cardSchema() {
    const divider = this._config?.divider ?? "border";
    return [
      {
        name: "",
        type: "grid",
        schema: [
          { name: "columns", selector: { number: { min: 1, max: 12, mode: "box" } } },
          {
            name: "divider",
            required: true,
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
          ...(divider !== "none"
            ? [
                { name: "divider_width", selector: { text: {} } },
                { name: "divider_color", selector: { text: {} } },
              ]
            : []),
          ...(divider === "gap" ? [{ name: "gap", selector: { text: {} } }] : []),
        ],
      },
    ];
  }

  private _defaultsSchema(data: Record<string, unknown>) {
    const hasMenus = (this._config?.buttons ?? []).some((b) => b.buttons?.length);
    return [
      ...(hasMenus
        ? [
            {
              name: "menu_settings",
              type: "expandable",
              flatten: true,
              iconPath: mdiFileTree,
              schema: [
                {
                  name: "menu_timeout",
                  selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } },
                },
                { name: "menu_close_on_action", selector: { boolean: {} } },
                { name: "menu_resize", selector: { boolean: {} } },
                ...this._backSchema(data),
              ],
            },
          ]
        : []),
      {
        name: "button_defaults",
        type: "expandable",
        flatten: true,
        iconPath: mdiTune,
        schema: [
          this._togglesSchema(),
          ...this._toggleFields(data),
          { name: "state_display", selector: { text: { multiline: true } } },
          { name: "icon_height", selector: { text: { suffix: "px" } } },
          { name: "show_entity_picture", selector: { boolean: {} } },
          ...this._appearanceFields(data),
        ],
      },
    ];
  }

  private _backSchema(data: Record<string, unknown>) {
    const mode =
      data.menu_back === false ? "none" : data.menu_back === true ? "left" : data.menu_back;
    const asButton = mode === "start" || mode === "end";
    return [
      {
        name: "menu_back",
        required: true,
        selector: {
          select: {
            mode: "dropdown",
            options: [
              "left",
              "right",
              "top",
              "bottom",
              "top_left",
              "top_right",
              "bottom_left",
              "bottom_right",
              "start",
              "end",
              "none",
            ].map((value) => ({ value, label: this._t(`menu_back_${value}`) })),
          },
        },
      },
      ...(mode === "none"
        ? []
        : [
            {
              name: "",
              type: "grid",
              schema: [
                { name: "menu_back_icon", selector: { icon: {} } },
                asButton
                  ? { name: "menu_back_name", selector: { text: {} } }
                  : { name: "menu_back_size", selector: { text: {} } },
              ],
            },
            { name: "menu_back_color", selector: { ui_color: {} } },
          ]),
    ];
  }

  private _togglesSchema() {
    return {
      name: "",
      type: "grid",
      column_min_width: "160px",
      schema: [
        { name: "show_name", selector: { boolean: {} } },
        { name: "show_state", selector: { boolean: {} } },
        { name: "show_icon", selector: { boolean: {} } },
        { name: "show_toggle", selector: { boolean: {} } },
      ],
    };
  }

  /** Mini switch options, only while the switch is shown. */
  private _toggleFields(data: Record<string, unknown>) {
    if (!data.show_toggle) return [];
    return [
      {
        name: "",
        type: "grid",
        schema: [
          { name: "toggle_icon_on", selector: { icon: {} } },
          { name: "toggle_icon_off", selector: { icon: {} } },
        ],
      },
      { name: "toggle_color", selector: { ui_color: {} } },
    ];
  }

  /** Color, "when on" style with its dependent options, animation. */
  private _appearanceFields(data: Record<string, unknown>) {
    const style = activeStyle(data);
    return [
      {
        name: "color",
        selector: {
          ui_color: { default_color: "state", include_state: true, include_none: true },
        },
      },
      {
        name: "active_style",
        required: true,
        selector: {
          select: {
            mode: "dropdown",
            options: (["icon", "tint", "fill"] as const).map((value) => ({
              value,
              label: this._t(`active_${value}`),
            })),
          },
        },
      },
      ...(style === "tint"
        ? [
            {
              name: "background_opacity",
              selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } },
            },
          ]
        : []),
      ...(style === "fill" ? this._switchSchema() : []),
      this._animationSchema(),
    ];
  }

  private _switchSchema() {
    return [
      {
        name: "",
        type: "grid",
        schema: [
          {
            name: "switch_animation",
            selector: {
              select: {
                mode: "dropdown",
                options: SWITCH_ANIMATIONS.map((value) => ({
                  value,
                  label: this._t(`switch_${value}`),
                })),
              },
            },
          },
          { name: "switch_text_color", selector: { ui_color: {} } },
        ],
      },
    ];
  }

  private _animationSchema() {
    return {
      name: "animation",
      selector: {
        select: {
          mode: "dropdown",
          options: ANIMATIONS.map((value) => ({ value, label: this._t(`animation_${value}`) })),
        },
      },
    };
  }

  private _buttonSchema(button: SegmentConfig, data: Record<string, unknown>, path: Path) {
    const parent = path.length > 1 ? this._buttonAt(path.slice(0, -1)) : undefined;
    const siblings = this._buttonsAt(path.slice(0, -1));
    const columns = (parent ? parent.menu_columns : this._config?.columns) ?? siblings.length;
    // The gesture that opens a menu has no action of its own.
    const menuGesture = button.buttons?.length ? (button.menu_open ?? "tap") : undefined;
    const actionFields = [
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
    ].filter((field) => field.name !== `${menuGesture}_action`);
    // The entity_name selector exists since the 2025.12 entity naming changes
    // and only makes sense when there is an entity to compose a name from.
    const nameSelector =
      button.entity && atLeast(this.hass?.config?.version, 2025, 12)
      ? { selector: { entity_name: {} }, context: { entity: "entity" } }
      : { selector: { text: {} } };
    return [
      { name: "entity", selector: { entity: {} } },
      { name: "name", ...nameSelector },
      { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } },
      {
        name: "content",
        type: "expandable",
        flatten: true,
        iconPath: mdiTextShort,
        schema: [
          this._togglesSchema(),
          ...this._toggleFields(data),
          { name: "state_display", selector: { text: { multiline: true } } },
          {
            name: "",
            type: "grid",
            schema: [
              { name: "icon_on", selector: { icon: {} } },
              { name: "icon_off", selector: { icon: {} } },
            ],
          },
          { name: "icon_height", selector: { text: { suffix: "px" } } },
          { name: "show_entity_picture", selector: { boolean: {} } },
          ...(data.show_entity_picture || data.entity_picture
            ? [{ name: "entity_picture", selector: { text: {} } }]
            : []),
        ],
      },
      {
        name: "appearance",
        type: "expandable",
        flatten: true,
        iconPath: mdiPalette,
        schema: this._appearanceFields(data),
      },
      {
        name: "layout",
        type: "expandable",
        flatten: true,
        iconPath: mdiViewGrid,
        schema: [
          {
            name: "",
            type: "grid",
            schema: [
              { name: "span", selector: { number: { min: 1, max: columns, mode: "box" } } },
              { name: "row_span", selector: { number: { min: 1, max: 12, mode: "box" } } },
            ],
          },
        ],
      },
      {
        name: "interactions",
        type: "expandable",
        flatten: true,
        iconPath: mdiGestureTap,
        schema: [
          ...actionFields,
          ...(menuGesture === "double_tap"
            ? []
            : [
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
              ]),
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
      show_entity_picture: config.show_entity_picture ?? CARD_DEFAULTS.show_entity_picture,
      show_toggle: config.show_toggle ?? CARD_DEFAULTS.show_toggle,
      switch_style: config.switch_style ?? CARD_DEFAULTS.switch_style,
      menu_close_on_action: config.menu_close_on_action ?? CARD_DEFAULTS.menu_close_on_action,
      menu_open: "tap",
      ...(config.animation ? { animation: config.animation } : {}),
    };
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const buttons = this._config.buttons ?? [];

    const data = withDefaults(this._config, CARD_DEFAULTS);
    if (typeof data.menu_back === "boolean") data.menu_back = data.menu_back ? "left" : "none";
    data.active_style = activeStyle(data);

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this._cardSchema()}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._cardChanged}
      ></ha-form>

      <div class="buttons">
        <h3>${this._t("buttons")}</h3>
        ${this._renderButtonList(buttons, [])}
      </div>

      <ha-form
        class="defaults"
        .hass=${this.hass}
        .data=${data}
        .schema=${this._defaultsSchema(data)}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._cardChanged}
      ></ha-form>
    `;
  }

  private _renderButtonList(buttons: SegmentConfig[], path: Path): TemplateResult {
    return html`
      ${buttons.map((button, index) =>
        this._renderButton(button, [...path, index], buttons.length)
      )}
      <ha-button appearance="filled" @click=${() => this._addButton(path)}>
        <ha-svg-icon slot="start" .path=${mdiPlus}></ha-svg-icon>
        ${this._t("add_button")}
      </ha-button>
    `;
  }

  private _menuSchema() {
    return [
      {
        name: "",
        type: "grid",
        schema: [
          {
            name: "menu_open",
            selector: {
              select: {
                mode: "dropdown",
                options: ["tap", "hold", "double_tap"].map((value) => ({
                  value,
                  label: this._t(`menu_open_${value}`),
                })),
              },
            },
          },
          { name: "menu_columns", selector: { number: { min: 1, max: 12, mode: "box" } } },
        ],
      },
      { name: "menu_close_on_action", selector: { boolean: {} } },
    ];
  }

  private _renderButton(button: SegmentConfig, path: Path, count: number): TemplateResult {
    const index = path[path.length - 1];
    const key = path.join(".");
    const expanded = this._expanded === key || !!this._expanded?.startsWith(`${key}.`);
    const subButtons = button.buttons ?? [];
    const stateObj = button.entity ? this.hass!.states[button.entity] : undefined;
    const name =
      typeof button.name === "string"
        ? button.name
        : stateObj && this.hass!.formatEntityName
          ? this.hass!.formatEntityName(stateObj, button.name)
          : stateObj?.attributes.friendly_name;
    const data = withDefaults(button, this._buttonDefaults());
    data.active_style = activeStyle(data);
    if (typeof data.icon_height === "string" && data.icon_height.endsWith("px")) {
      data.icon_height = String(parseFloat(data.icon_height));
    }

    return html`
      <ha-expansion-panel
        outlined
        left-chevron
        .expanded=${expanded}
        .header=${name || `${this._t("button")} ${index + 1}`}
        .secondary=${[
          button.entity,
          subButtons.length ? `${this._t("submenu")}: ${this._count(subButtons.length)}` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
        @expanded-changed=${(ev: CustomEvent) => this._expandedChanged(ev, key)}
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
            @click=${() => this._moveButton(path, -1)}
          ></ha-icon-button>
          <ha-icon-button
            .label=${this._t("move_down")}
            .path=${mdiArrowDown}
            .disabled=${index === count - 1}
            @click=${() => this._moveButton(path, 1)}
          ></ha-icon-button>
          <ha-icon-button
            .label=${this._t("duplicate")}
            .path=${mdiContentCopy}
            @click=${() => this._duplicateButton(path)}
          ></ha-icon-button>
          <ha-icon-button
            .label=${this._t("remove")}
            .path=${mdiDelete}
            .disabled=${count === 1 && path.length === 1}
            @click=${() => this._removeButton(path)}
          ></ha-icon-button>
        </div>
        <ha-form
          .hass=${this.hass}
          .data=${data}
          .schema=${this._buttonSchema(button, data, path)}
          .computeLabel=${this._computeLabel}
          .computeHelper=${this._computeHelper}
          @value-changed=${(ev: CustomEvent) => this._buttonChanged(ev, path)}
        ></ha-form>
        <ha-expansion-panel
          class="visibility"
          outlined
          .header=${this._t("visibility")}
          .secondary=${button.visibility?.length
            ? `${button.visibility.length} ${this._t(
                button.visibility.length === 1 ? "condition_count" : "conditions_count"
              )}`
            : ""}
        >
          <ha-svg-icon slot="leading-icon" .path=${mdiEye}></ha-svg-icon>
          <p class="help">${this._t("visibility_help")}</p>
          <split-button-visibility-editor
            .hass=${this.hass}
            .entityId=${button.entity}
            .conditions=${button.visibility ?? []}
            @value-changed=${(ev: CustomEvent) => this._visibilityChanged(ev, path)}
          ></split-button-visibility-editor>
        </ha-expansion-panel>
        <ha-expansion-panel
          class="submenu"
          outlined
          .header=${this._t("submenu")}
          .secondary=${subButtons.length ? this._count(subButtons.length) : ""}
        >
          <ha-svg-icon slot="leading-icon" .path=${mdiMenu}></ha-svg-icon>
          <p class="help">${this._t("submenu_help")}</p>
          ${subButtons.length
            ? html`<ha-form
                .hass=${this.hass}
                .data=${data}
                .schema=${this._menuSchema()}
                .computeLabel=${this._computeLabel}
                .computeHelper=${this._computeHelper}
                @value-changed=${(ev: CustomEvent) => this._buttonChanged(ev, path)}
              ></ha-form>`
            : nothing}
          <div class="buttons nested">${this._renderButtonList(subButtons, path)}</div>
        </ha-expansion-panel>
      </ha-expansion-panel>
    `;
  }

  private _count(count: number): string {
    return `${count} ${this._t(count === 1 ? "button_count" : "buttons_count")}`;
  }

  private _computeLabel = (schema: { name: string }): string => {
    if (GENERIC_KEYS.has(schema.name)) {
      const label = this.hass!.localize?.(`ui.panel.lovelace.editor.card.generic.${schema.name}`);
      if (label) return label;
    }
    return this._t(schema.name);
  };

  private _computeHelper = (schema: { name: string }): string | undefined => {
    switch (schema.name) {
      case "tap_action":
      case "hold_action":
        return this.hass!.localize?.("ui.panel.lovelace.editor.card.button.default_action_help");
      case "columns":
      case "menu_columns":
      case "menu_timeout":
      case "menu_resize":
      case "menu_back_size":
      case "state_display":
      case "entity_picture":
        return this._t(`${schema.name}_help`);
      case "span":
        return this._t("layout_help");
      default:
        return undefined;
    }
  };

  private _expandedChanged(ev: CustomEvent, key: string): void {
    // Nested panels (conditions, interactions) fire the same event and it
    // bubbles up here; only react to the button's own panel.
    if (ev.target !== ev.currentTarget) return;
    ev.stopPropagation();
    const parent = key.includes(".") ? key.slice(0, key.lastIndexOf(".")) : undefined;
    if (ev.detail.expanded) {
      if (this._expanded !== key && !this._expanded?.startsWith(`${key}.`)) this._expanded = key;
    } else if (this._expanded === key || this._expanded?.startsWith(`${key}.`)) {
      this._expanded = parent;
    }
  }

  private _cardChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const value = stripDefaults(
      applyActiveStyle(ev.detail.value, CARD_DEFAULTS),
      this._config!,
      CARD_DEFAULTS
    );
    this._updateConfig(value as SplitButtonCardConfig);
  }

  /** The buttons of a level: [] is the card, [0] the menu of button 0, … */
  private _buttonsAt(path: Path): SegmentConfig[] {
    let buttons = this._config!.buttons ?? [];
    for (const index of path) buttons = buttons[index]?.buttons ?? [];
    return buttons;
  }

  private _buttonAt(path: Path): SegmentConfig {
    return this._buttonsAt(path.slice(0, -1))[path[path.length - 1]];
  }

  /** Replaces the buttons of a level, copying every level above it. */
  private _setButtons(path: Path, update: (buttons: SegmentConfig[]) => SegmentConfig[]): void {
    const apply = (buttons: SegmentConfig[], rest: Path): SegmentConfig[] => {
      if (!rest.length) return update([...buttons]);
      const [index, ...tail] = rest;
      const copy = [...buttons];
      const button = { ...copy[index] };
      const children = apply(button.buttons ?? [], tail);
      if (children.length) button.buttons = children;
      else delete button.buttons;
      copy[index] = button;
      return copy;
    };
    this._updateConfig({ ...this._config!, buttons: apply(this._config!.buttons ?? [], path) });
  }

  private _updateButton(path: Path, update: (button: SegmentConfig) => SegmentConfig): void {
    const index = path[path.length - 1];
    this._setButtons(path.slice(0, -1), (buttons) => {
      buttons[index] = update(buttons[index]);
      return buttons;
    });
  }

  private _buttonChanged(ev: CustomEvent, path: Path): void {
    ev.stopPropagation();
    const defaults = this._buttonDefaults();
    this._updateButton(path, (button) => {
      const value = stripDefaults(applyActiveStyle(ev.detail.value, defaults), button, defaults);
      if (value.icon_height && !String(value.icon_height).endsWith("px")) {
        value.icon_height = `${value.icon_height}px`;
      }
      // The form only knows the buttons it was rendered with.
      if (button.buttons) value.buttons = button.buttons;
      return value as SegmentConfig;
    });
  }

  private _visibilityChanged(ev: CustomEvent, path: Path): void {
    ev.stopPropagation();
    const conditions = ev.detail.value;
    this._updateButton(path, (original) => {
      const button = { ...original };
      if (Array.isArray(conditions) && conditions.length) {
        button.visibility = conditions;
      } else {
        delete button.visibility;
      }
      return button;
    });
  }

  private _addButton(path: Path): void {
    const count = this._buttonsAt(path).length;
    this._expanded = [...path, count].join(".");
    this._setButtons(path, (buttons) => [...buttons, { icon: "mdi:gesture-tap-button" }]);
  }

  private _duplicateButton(path: Path): void {
    const index = path[path.length - 1];
    this._expanded = [...path.slice(0, -1), index + 1].join(".");
    this._setButtons(path.slice(0, -1), (buttons) => {
      buttons.splice(index + 1, 0, structuredClone(buttons[index]));
      return buttons;
    });
  }

  private _removeButton(path: Path): void {
    const index = path[path.length - 1];
    this._expanded = path.length > 1 ? path.slice(0, -1).join(".") : undefined;
    this._setButtons(path.slice(0, -1), (buttons) => buttons.filter((_, i) => i !== index));
  }

  private _moveButton(path: Path, offset: number): void {
    const index = path[path.length - 1];
    const key = path.join(".");
    if (this._expanded === key || this._expanded?.startsWith(`${key}.`)) {
      const moved = [...path.slice(0, -1), index + offset].join(".");
      this._expanded = moved + this._expanded.slice(key.length);
    }
    this._setButtons(path.slice(0, -1), (buttons) => {
      const [button] = buttons.splice(index, 1);
      buttons.splice(index + offset, 0, button);
      return buttons;
    });
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

    ha-expansion-panel.visibility {
      margin-top: 24px;
      --expansion-panel-summary-padding: 0 8px;
    }

    ha-expansion-panel.submenu {
      margin-top: 8px;
      --expansion-panel-summary-padding: 0 8px;
    }

    .buttons.nested {
      margin-top: 8px;
    }

    ha-form.defaults {
      display: block;
      margin-top: 24px;
    }

    .help {
      margin: 8px 0;
      color: var(--secondary-text-color);
      font-size: var(--ha-font-size-s, 12px);
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

// Same context key the frontend uses, so its condition editors offer the
// button's entity as "current entity".
const conditionsEntityContext = createContext<
  { mode: "current"; entityId: string } | undefined
>("conditions-entity-context");

@customElement("split-button-visibility-editor")
export class SplitButtonVisibilityEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public entityId?: string;

  @property({ attribute: false }) public conditions: Record<string, unknown>[] = [];

  private _provider = new ContextProvider(this, {
    context: conditionsEntityContext,
    initialValue: undefined,
  });

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("entityId")) {
      this._provider.setValue(
        this.entityId ? { mode: "current", entityId: this.entityId } : undefined
      );
    }
  }

  protected render() {
    // The conditions editor is loaded with the card edit dialog; fall back
    // to a YAML field wherever it is not available.
    if (customElements.get("ha-card-conditions-editor")) {
      return html`<ha-card-conditions-editor
        .hass=${this.hass}
        .conditions=${this.conditions}
      ></ha-card-conditions-editor>`;
    }
    return html`<ha-form
      .hass=${this.hass}
      .data=${{ visibility: this.conditions }}
      .schema=${[{ name: "visibility", selector: { object: {} } }]}
      .computeLabel=${() => ""}
      @value-changed=${this._yamlChanged}
    ></ha-form>`;
  }

  private _yamlChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("value-changed", { detail: { value: ev.detail.value.visibility } })
    );
  }
}

const stopPropagation = (ev: Event) => ev.stopPropagation();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Returns `next`, but with every part that is deep-equal to the matching
 * part of `prev` replaced by the object from `prev`.
 */
const reuseEqual = <T>(prev: unknown, next: T): T => {
  if (prev === next) return next;
  if (Array.isArray(prev) && Array.isArray(next)) {
    const items = next.map((item, i) => reuseEqual(prev[i], item));
    return (
      items.length === prev.length && items.every((item, i) => item === prev[i]) ? prev : items
    ) as T;
  }
  if (isPlainObject(prev) && isPlainObject(next)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next)) {
      result[key] = reuseEqual(prev[key], value);
    }
    const keys = Object.keys(result);
    const same =
      keys.length === Object.keys(prev).length &&
      keys.every((key) => key in prev && result[key] === prev[key]);
    return (same ? prev : result) as T;
  }
  return next;
};

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
    "split-button-visibility-editor": SplitButtonVisibilityEditor;
  }
}
