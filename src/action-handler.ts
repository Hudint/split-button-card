// Tap / hold / double-tap detection with the same timings as the
// frontend's action-handler directive.

export type Action = "tap" | "hold" | "double_tap";

export interface ActionHandlerOptions {
  hasHold: boolean;
  hasDoubleClick: boolean;
}

const HOLD_TIME = 500;
const DOUBLE_TAP_TIME = 250;
const MOVE_TOLERANCE = 10;

export class ActionHandler {
  public options: ActionHandlerOptions = { hasHold: false, hasDoubleClick: false };

  private _holdTimer?: number;

  private _dblTimer?: number;

  private _held = false;

  private _start?: { x: number; y: number };

  constructor(
    element: HTMLElement,
    private readonly _onAction: (action: Action) => void
  ) {
    element.addEventListener("pointerdown", this._pointerDown);
    element.addEventListener("pointerup", this._pointerUp);
    element.addEventListener("pointermove", this._pointerMove);
    element.addEventListener("pointercancel", this._cancel);
    element.addEventListener("pointerleave", this._cancel);
    element.addEventListener("keydown", this._keyDown);
    // Long-press on touch devices would otherwise open the context menu.
    element.addEventListener("contextmenu", (ev) => {
      if (this.options.hasHold) ev.preventDefault();
    });
  }

  private _pointerDown = (ev: PointerEvent): void => {
    if (ev.button !== 0) return;
    this._held = false;
    this._start = { x: ev.clientX, y: ev.clientY };
    if (this.options.hasHold) {
      this._holdTimer = window.setTimeout(() => {
        this._held = true;
        this._holdTimer = undefined;
      }, HOLD_TIME);
    }
  };

  private _pointerMove = (ev: PointerEvent): void => {
    if (!this._start) return;
    if (
      Math.abs(ev.clientX - this._start.x) > MOVE_TOLERANCE ||
      Math.abs(ev.clientY - this._start.y) > MOVE_TOLERANCE
    ) {
      this._cancel();
    }
  };

  private _cancel = (): void => {
    clearTimeout(this._holdTimer);
    this._holdTimer = undefined;
    this._start = undefined;
    this._held = false;
  };

  private _pointerUp = (ev: PointerEvent): void => {
    if (ev.button !== 0 || !this._start) return;
    clearTimeout(this._holdTimer);
    this._holdTimer = undefined;
    this._start = undefined;

    if (this._held) {
      this._held = false;
      this._onAction("hold");
      return;
    }

    if (!this.options.hasDoubleClick) {
      this._onAction("tap");
      return;
    }

    if (this._dblTimer !== undefined) {
      clearTimeout(this._dblTimer);
      this._dblTimer = undefined;
      this._onAction("double_tap");
      return;
    }
    this._dblTimer = window.setTimeout(() => {
      this._dblTimer = undefined;
      this._onAction("tap");
    }, DOUBLE_TAP_TIME);
  };

  private _keyDown = (ev: KeyboardEvent): void => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    if (!ev.repeat) this._onAction("tap");
  };
}
