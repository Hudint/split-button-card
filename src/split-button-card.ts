import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { styleMap } from "lit/directives/style-map.js";
import { checkConditionsMet, usesCondition } from "./conditions";
import { computeCssColor } from "./state-color";
import { loadHaForm } from "./editor";
import { ANIMATIONS, SWITCH_ANIMATIONS, defaultTapAction } from "./split-button-segment";
import type {
  ActionConfig,
  DividerMode,
  HomeAssistant,
  MenuBack,
  MenuGesture,
  SegmentConfig,
  SplitButtonCardConfig,
} from "./types";

const CARD_VERSION = "0.7.0";

const DIVIDER_MODES: DividerMode[] = ["border", "line", "gap", "none"];

const MENU_GESTURES: MenuGesture[] = ["tap", "hold", "double_tap"];

// Internal action a menu button gets for the gesture that opens its menu.
const MENU_ACTION = "split-button-menu";

// Internal action of the back button when it is shown as a button.
const BACK_ACTION = "split-button-back";

const MENU_BACKS: MenuBack[] = [
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
];

/** Where the back button goes; `true`/`false` are accepted for left/none. */
const backMode = (config?: SplitButtonCardConfig): MenuBack =>
  config?.menu_back === false ? "none" : config?.menu_back === true || !config?.menu_back ? "left" : config.menu_back;

const DEFAULT_MENU_TIMEOUT = 15;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Card border as drawn by ha-card, reused for the "border" divider.
const CARD_BORDER_WIDTH = "var(--ha-card-border-width, 1px)";
const CARD_BORDER_COLOR = "var(--ha-card-border-color, var(--divider-color, #e0e0e0))";

@customElement("split-button-card")
export class SplitButtonCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: SplitButtonCardConfig;

  @state() private _segments: SegmentConfig[] = [];

  /** Set by the dashboard while editing: hidden buttons are shown dimmed. */
  @property({ attribute: false }) public editMode = false;

  @property({ type: Boolean }) public preview = false;

  // Keep receiving hass updates while hidden, so the card can reappear.
  public connectedWhileHidden = true;

  private _shown: { segment: SegmentConfig; visible: boolean }[] = [];

  /** Indices of the opened menu buttons, one per level. Local to this browser. */
  @state() private _path: number[] = [];

  private _menuTimer?: number;

  private _reportedRows?: number;

  /** The back button as a segment, for menu_back: start / end. */
  private _backSegment?: SegmentConfig;

  private _timer?: number;

  private _onResize = () => this.requestUpdate();

  public static async getConfigElement(): Promise<HTMLElement> {
    await loadHaForm();
    return document.createElement("split-button-card-editor");
  }

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
    if (
      config.menu_timeout !== undefined &&
      (typeof config.menu_timeout !== "number" || config.menu_timeout < 0)
    ) {
      throw new Error("'menu_timeout' must be a number of seconds (0 = never)");
    }
    if (
      config.menu_back !== undefined &&
      typeof config.menu_back !== "boolean" &&
      !MENU_BACKS.includes(config.menu_back)
    ) {
      throw new Error(
        `Invalid menu_back '${config.menu_back}', use one of: ${MENU_BACKS.join(", ")}`
      );
    }
    validateButtons(config.buttons, config, "buttons");

    this._config = config;
    this._segments = normalizeButtons(config.buttons, config);
    const mode = backMode(config);
    this._backSegment =
      mode === "start" || mode === "end"
        ? {
            ...normalizeButtons([{}], config)[0],
            icon: config.menu_back_icon ?? "mdi:arrow-left",
            name: config.menu_back_name,
            color: config.menu_back_color,
            show_state: false,
            show_toggle: false,
            switch_style: false,
            state_background: false,
            animation: undefined,
            span: 1,
            row_span: 1,
            tap_action: { action: BACK_ACTION },
          }
        : undefined;
    // Keep an open menu while the config is edited, as long as it still exists.
    if (!this._resolvePath(this._path)) this._path = [];
    // Until hass arrives every button counts as visible (for grid sizing).
    this._shown = this._level.map((segment) => ({ segment, visible: true }));
    if (this.isConnected) this._setupListeners();
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._setupListeners();
    if (this._path.length) this._restartMenuTimer();
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._clearListeners();
    clearTimeout(this._menuTimer);
  }

  // Screen and time conditions change without a state change in hass.
  private _setupListeners(): void {
    this._clearListeners();
    const conditions = allSegments(this._segments).flatMap((s) => s.visibility ?? []);
    if (usesCondition(conditions, ["screen"])) {
      window.addEventListener("resize", this._onResize);
    }
    if (usesCondition(conditions, ["time"])) {
      this._timer = window.setInterval(() => this.requestUpdate(), 30_000);
    }
  }

  private _clearListeners(): void {
    window.removeEventListener("resize", this._onResize);
    clearInterval(this._timer);
    this._timer = undefined;
  }

  private get _editing(): boolean {
    return this.editMode || this.preview;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const hass = this.hass;
    if (this._backSegment && this._backSegment.name === undefined && hass) {
      this._backSegment = {
        ...this._backSegment,
        name: hass.localize?.("ui.common.back") || "Back",
      };
    }
    this._shown = this._level
      .map((segment) => ({
        segment,
        visible:
          !segment.visibility?.length ||
          !hass ||
          checkConditionsMet(segment.visibility, hass, segment.entity),
      }))
      .filter(({ visible }) => visible || this._editing);
  }

  protected updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    // Hide the whole card when none of its buttons is visible.
    const hidden = this._shown.length === 0 && !this._path.length;
    if (this.hidden !== hidden) {
      this.hidden = hidden;
      this.dispatchEvent(new CustomEvent("card-visibility-changed", { detail: { value: !hidden } }));
    }
    // Sections only ask for the grid size when they render; hui-card's
    // "card-updated" makes them render again after the number of rows changed.
    const rows = this._rows;
    if (this._reportedRows !== undefined && this._reportedRows !== rows) {
      const parent = this.parentElement;
      if (parent?.localName === "hui-card") parent.dispatchEvent(new CustomEvent("card-updated"));
    }
    this._reportedRows = rows;
  }

  /** Segments of the open menu level (the top level if no menu is open). */
  private get _level(): SegmentConfig[] {
    return this._resolvePath(this._path) ?? this._segments;
  }

  /** The button whose menu is open. */
  private get _menuParent(): SegmentConfig | undefined {
    let segments = this._segments;
    let parent: SegmentConfig | undefined;
    for (const index of this._path) {
      parent = segments[index];
      segments = parent?.buttons ?? [];
    }
    return parent;
  }

  private _resolvePath(path: number[]): SegmentConfig[] | undefined {
    let segments = this._segments;
    for (const index of path) {
      const next = segments[index]?.buttons;
      if (!next?.length) return undefined;
      segments = next;
    }
    return segments;
  }

  /** Segments of a menu, with the back button when it is one of them. */
  private _withBack<T>(items: T[], back: (segment: SegmentConfig) => T): T[] {
    if (!this._backSegment) return items;
    const item = back(this._backSegment);
    return backMode(this._config) === "start" ? [item, ...items] : [...items, item];
  }

  /** What the grid shows: the visible segments, plus a back button in a menu. */
  private get _gridItems(): { segment: SegmentConfig; visible: boolean }[] {
    if (!this._path.length) return this._shown;
    return this._withBack(this._shown, (segment) => ({ segment, visible: true }));
  }

  private get _columns(): number {
    const configured = this._path.length ? this._menuParent?.menu_columns : this._config?.columns;
    return configured ?? Math.max(this._gridItems.length, 1);
  }

  // Rows of the open level. Unless the card resizes with its menus, it keeps
  // the size of its largest level, so the dashboard around it does not move.
  private get _rows(): number {
    const rows = gridRows(
      this._gridItems.map(({ segment }) => segment),
      this._columns
    );
    if (this._config?.menu_resize) return rows;
    const menuRows = allMenus(this._segments).map((menu) => {
      const segments = this._withBack(menu.buttons!, (segment) => segment);
      return gridRows(segments, menu.menu_columns ?? segments.length);
    });
    return Math.max(rows, ...menuRows);
  }

  public getCardSize(): number {
    return this._rows * 3;
  }

  // Same footprint as the native button card (6 columns x 2 rows) for
  // every row of segments, so a single-row card replaces a button 1:1.
  public getGridOptions() {
    return {
      columns: 6,
      rows: this._rows * 2,
      min_columns: 2,
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

    const columns = this._columns;
    // The back button outside the grid: a strip on one side or a corner button.
    const mode = this._path.length ? backMode(config) : "none";
    const outside = !["none", "start", "end"].includes(mode);
    const corner = mode.includes("_");
    if (config.menu_back_size) vars["--sbc-back-size"] = config.menu_back_size;
    if (config.menu_back_color) vars["--sbc-back-color"] = computeCssColor(config.menu_back_color);
    const back = outside
      ? html`<div
          class=${`back back-${mode} ${corner ? "corner" : "strip"}`}
          role="button"
          tabindex="0"
          aria-label=${this.hass?.localize?.("ui.common.back") || "Back"}
          @click=${this._back}
        >
          <ha-ripple></ha-ripple>
          <ha-icon
            .icon=${config.menu_back_icon ?? (corner ? "mdi:arrow-left" : "mdi:chevron-left")}
          ></ha-icon>
        </div>`
      : nothing;
    const backFirst = mode === "left" || mode === "top";

    return html`
      <ha-card
        class=${`divider-${divider}`}
        style=${styleMap(vars)}
        @keydown=${this._onKeyDown}
        @pointerdown=${this._onInteraction}
      >
        <div class=${`body has-back-${mode}`}>
          ${backFirst ? back : nothing}
          <div class="grid" @hass-action=${this._onAction}>
            ${keyed(
              // New elements per level, so no state or transition carries over.
              this._path.join("/"),
              this._gridItems.map(
                ({ segment, visible }) => html`
                  <split-button-segment
                    ?dimmed=${!visible}
                    style=${styleMap({
                      "grid-column": `span ${Math.min(segment.span ?? 1, columns)}`,
                      "grid-row": `span ${segment.row_span ?? 1}`,
                    })}
                    .hass=${this.hass}
                    .config=${segment}
                  ></split-button-segment>
                `
              )
            )}
          </div>
          ${backFirst ? nothing : back}
        </div>
      </ha-card>
    `;
  }

  private _onAction(ev: CustomEvent<{ config: SegmentConfig; action: string }>): void {
    const { config, action } = ev.detail;
    const actionConfig = (config as Record<string, unknown>)[`${action}_action`] as
      | ActionConfig
      | undefined;
    if (actionConfig?.action === MENU_ACTION) {
      ev.stopPropagation();
      this._openMenu(config, ev.target as HTMLElement);
      return;
    }
    if (actionConfig?.action === BACK_ACTION) {
      ev.stopPropagation();
      this._back();
      return;
    }
    // Every other action bubbles on to Home Assistant.
    if (!this._path.length) return;
    const close =
      this._menuParent?.menu_close_on_action ?? this._config?.menu_close_on_action ?? true;
    if (close) {
      clearTimeout(this._menuTimer);
      // Short delay, so the ripple and the state change are still visible.
      this._menuTimer = window.setTimeout(() => this._navigate([]), 350);
    }
  }

  private _openMenu(segment: SegmentConfig, origin: HTMLElement): void {
    const index = this._level.indexOf(segment);
    if (index < 0) return;
    const before = this.renderRoot.querySelector<HTMLElement>(".body")?.getBoundingClientRect();
    const from = origin.getBoundingClientRect();
    this._navigate([...this._path, index], (body) => {
      if (!before) return;
      // The button splits open: the menu grows out of the tapped button.
      // The card may have been resized in between, so scale to its new size.
      const now = body.getBoundingClientRect();
      const sx = now.width / before.width;
      const sy = now.height / before.height;
      const inset = [
        (from.top - before.top) * sy,
        (before.right - from.right) * sx,
        (before.bottom - from.bottom) * sy,
        (from.left - before.left) * sx,
      ].map((value) => `${Math.max(0, value)}px`);
      const timing = { duration: 340, easing: "cubic-bezier(0.2, 0, 0, 1)" };
      body.animate(
        [{ clipPath: `inset(${inset.join(" ")})` }, { clipPath: "inset(0px 0px 0px 0px)" }],
        timing
      );
      // The new buttons slide apart from the middle of the tapped one.
      const originX = (from.left + from.width / 2 - before.left) * sx + now.left;
      const originY = (from.top + from.height / 2 - before.top) * sy + now.top;
      for (const element of body.querySelectorAll<HTMLElement>("split-button-segment, .back")) {
        const rect = element.getBoundingClientRect();
        const dx = (originX - (rect.left + rect.width / 2)) * 0.6;
        const dy = (originY - (rect.top + rect.height / 2)) * 0.6;
        element.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(0.85)`, opacity: 0 },
            { transform: "none", opacity: 1 },
          ],
          timing
        );
      }
    });
  }

  private _back(): void {
    this._navigate(this._path.slice(0, -1));
  }

  private async _navigate(path: number[], animate?: (body: HTMLElement) => void): Promise<void> {
    clearTimeout(this._menuTimer);
    if (path.join("/") === this._path.join("/")) return;
    this._path = path;
    this._restartMenuTimer();
    await this.updateComplete;
    const body = this.renderRoot.querySelector<HTMLElement>(".body");
    if (!body || reducedMotion()) return;
    if (animate) {
      animate(body);
    } else {
      body.animate(
        [
          { opacity: 0, transform: "scale(0.96)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 220, easing: "ease-out" }
      );
    }
  }

  // Without interaction an open menu returns to the start after a while.
  private _restartMenuTimer(): void {
    clearTimeout(this._menuTimer);
    const timeout = this._config?.menu_timeout ?? DEFAULT_MENU_TIMEOUT;
    if (!timeout || this._editing || !this._path.length) return;
    this._menuTimer = window.setTimeout(() => this._navigate([]), timeout * 1000);
  }

  private _onInteraction = () => {
    if (this._path.length) this._restartMenuTimer();
  };

  private _onKeyDown(ev: KeyboardEvent): void {
    if (!this._path.length) return;
    const onBack = (ev.target as HTMLElement).classList?.contains("back");
    if (ev.key === "Escape" || (onBack && (ev.key === "Enter" || ev.key === " "))) {
      ev.preventDefault();
      ev.stopPropagation();
      this._back();
    }
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    :host([hidden]) {
      display: none;
    }

    ha-card {
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }

    .body {
      display: flex;
      height: 100%;
    }

    .grid {
      flex: 1;
      min-width: 0;
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

    /* Back button of an open menu: a strip on one side or a corner button. */
    .body {
      position: relative;
    }

    .body.has-back-top,
    .body.has-back-bottom {
      flex-direction: column;
    }

    .body.has-back-top .grid,
    .body.has-back-bottom .grid {
      flex: 1 1 0;
      min-height: 0;
    }

    /* Next to a strip on the right or bottom the outermost dividers are not
       clipped: they separate the grid from the strip. */
    .divider-border .has-back-top .grid,
    .divider-line .has-back-top .grid {
      height: auto;
    }

    .divider-border .has-back-bottom .grid,
    .divider-line .has-back-bottom .grid {
      height: auto;
      margin-bottom: 0;
    }

    .divider-border .has-back-right .grid,
    .divider-line .has-back-right .grid {
      margin-right: 0;
    }

    .back {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--sbc-back-color, var(--secondary-text-color));
      cursor: pointer;
      outline: none;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
      --ha-ripple-color: var(--sbc-back-color, var(--secondary-text-color));
      --ha-ripple-hover-opacity: 0.04;
      --ha-ripple-pressed-opacity: 0.12;
      --mdc-icon-size: 24px;
    }

    .back:focus-visible {
      box-shadow: inset 0 0 0 2px var(--sbc-back-color, var(--secondary-text-color));
    }

    .back.strip {
      flex: 0 0 var(--sbc-back-size, 32px);
    }

    .back-left::after,
    .back-top::after {
      content: "";
      display: var(--sbc-divider-display, none);
      position: absolute;
      background: var(--sbc-divider-color);
    }

    .back-left::after {
      top: var(--sbc-divider-inset, 0);
      bottom: var(--sbc-divider-inset, 0);
      right: 0;
      width: var(--sbc-divider-width);
    }

    .back-top::after {
      left: var(--sbc-divider-inset, 0);
      right: var(--sbc-divider-inset, 0);
      bottom: 0;
      height: var(--sbc-divider-width);
    }

    .divider-gap .back.strip {
      border: var(--sbc-segment-border);
      border-radius: var(--sbc-segment-radius);
    }

    .divider-gap .back-left {
      margin: var(--sbc-gap) 0 var(--sbc-gap) var(--sbc-gap);
    }

    .divider-gap .back-right {
      margin: var(--sbc-gap) var(--sbc-gap) var(--sbc-gap) 0;
    }

    .divider-gap .back-top {
      margin: var(--sbc-gap) var(--sbc-gap) 0;
    }

    .divider-gap .back-bottom {
      margin: 0 var(--sbc-gap) var(--sbc-gap);
    }

    /* Corner button floating above the menu. */
    .back.corner {
      position: absolute;
      z-index: 1;
      width: var(--sbc-back-size, 28px);
      height: var(--sbc-back-size, 28px);
      border-radius: 50%;
      background: var(
        --sbc-back-background,
        color-mix(in srgb, var(--sbc-back-color, rgb(127, 127, 127)) 18%, transparent)
      );
      --mdc-icon-size: calc(var(--sbc-back-size, 28px) * 0.6);
    }

    .back-top_left {
      top: 6px;
      left: 6px;
    }

    .back-top_right {
      top: 6px;
      right: 6px;
    }

    .back-bottom_left {
      bottom: 6px;
      left: 6px;
    }

    .back-bottom_right {
      bottom: 6px;
      right: 6px;
    }
  `;
}

const validateButtons = (
  buttons: SegmentConfig[],
  config: SplitButtonCardConfig,
  path: string
): void => {
  buttons.forEach((button, i) => {
    const where = `${path}[${i}]`;
    if (!button || typeof button !== "object") {
      throw new Error(`${where} must be an object`);
    }
    if (button.entity && !/^\w+\.\w+$/.test(button.entity)) {
      throw new Error(`${where}: invalid entity '${button.entity}'`);
    }
    if (button.visibility !== undefined && !Array.isArray(button.visibility)) {
      throw new Error(`${where}: 'visibility' must be a list of conditions`);
    }
    const animation = button.animation ?? config.animation;
    if (animation && !(ANIMATIONS as readonly string[]).includes(animation)) {
      throw new Error(
        `${where}: invalid animation '${animation}', use one of: ${ANIMATIONS.join(", ")}`
      );
    }
    const switchAnimation = button.switch_animation ?? config.switch_animation;
    if (switchAnimation && !(SWITCH_ANIMATIONS as readonly string[]).includes(switchAnimation)) {
      throw new Error(
        `${where}: invalid switch_animation '${switchAnimation}', use one of: ${SWITCH_ANIMATIONS.join(", ")}`
      );
    }
    for (const key of ["span", "row_span", "menu_columns"] as const) {
      const value = button[key];
      if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
        throw new Error(`${where}: '${key}' must be a positive integer`);
      }
    }
    if (button.menu_open && !MENU_GESTURES.includes(button.menu_open)) {
      throw new Error(
        `${where}: invalid menu_open '${button.menu_open}', use one of: ${MENU_GESTURES.join(", ")}`
      );
    }
    if (button.buttons !== undefined) {
      if (!Array.isArray(button.buttons)) {
        throw new Error(`${where}: 'buttons' must be a list of buttons`);
      }
      validateButtons(button.buttons, config, `${where}.buttons`);
    }
  });
};

/** Applies the card-level defaults to every button, menus included. */
const normalizeButtons = (
  buttons: SegmentConfig[],
  config: SplitButtonCardConfig
): SegmentConfig[] =>
  buttons.map((button) => {
    const segment: SegmentConfig = {
      show_icon: config.show_icon ?? true,
      show_name: config.show_name ?? true,
      show_state: config.show_state ?? false,
      icon_height: config.icon_height,
      color: config.color,
      state_color: config.state_color,
      state_background: config.state_background ?? false,
      background_opacity: config.background_opacity,
      show_entity_picture: config.show_entity_picture ?? false,
      show_toggle: config.show_toggle ?? false,
      toggle_color: config.toggle_color,
      toggle_icon_on: config.toggle_icon_on,
      toggle_icon_off: config.toggle_icon_off,
      animation: config.animation,
      state_display: config.state_display,
      switch_style: config.switch_style ?? false,
      switch_animation: config.switch_animation,
      switch_text_color: config.switch_text_color,
      tap_action: defaultTapAction(button.entity),
      hold_action: { action: "more-info" },
      double_tap_action: { action: "none" },
      ...button,
    };
    if (button.buttons?.length) {
      segment.buttons = normalizeButtons(button.buttons, config);
      // The gesture that opens the menu replaces that gesture's action.
      segment[`${button.menu_open ?? "tap"}_action`] = { action: MENU_ACTION };
    } else {
      delete segment.buttons;
    }
    return segment;
  });

/** Every button on every level. */
const allSegments = (segments: SegmentConfig[]): SegmentConfig[] =>
  segments.flatMap((segment) => [segment, ...allSegments(segment.buttons ?? [])]);

/** Every button that opens a menu, on every level. */
const allMenus = (segments: SegmentConfig[]): SegmentConfig[] =>
  allSegments(segments).filter((segment) => segment.buttons?.length);

/** Rows a grid needs, following CSS grid's auto-placement (no "dense"). */
const gridRows = (segments: SegmentConfig[], columns: number): number => {
  const occupied: boolean[][] = [];
  const isFree = (row: number, col: number, span: number, rowSpan: number) => {
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + span; c++) {
        if (occupied[r]?.[c]) return false;
      }
    }
    return true;
  };
  let cursorRow = 0;
  let cursorCol = 0;
  let rows = 0;
  for (const segment of segments) {
    const span = Math.min(segment.span ?? 1, columns);
    const rowSpan = segment.row_span ?? 1;
    while (cursorCol + span > columns || !isFree(cursorRow, cursorCol, span, rowSpan)) {
      cursorCol++;
      if (cursorCol + span > columns) {
        cursorCol = 0;
        cursorRow++;
      }
    }
    for (let r = cursorRow; r < cursorRow + rowSpan; r++) {
      occupied[r] = occupied[r] ?? [];
      for (let c = cursorCol; c < cursorCol + span; c++) occupied[r][c] = true;
    }
    rows = Math.max(rows, cursorRow + rowSpan);
    cursorCol += span;
  }
  return Math.max(rows, 1);
};

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
