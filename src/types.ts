export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  formatEntityState?: (stateObj: HassEntity) => string;
  user?: { id: string; [key: string]: any };
  formatEntityName?: (stateObj: HassEntity, name?: EntityName) => string;
  [key: string]: any;
}

export interface ActionConfig {
  action: string;
  [key: string]: any;
}

// Plain string, or the structured name the entity_name selector produces.
export type EntityName = string | Record<string, unknown> | Record<string, unknown>[];

export type DividerMode = "border" | "line" | "gap" | "none";

export interface SegmentConfig {
  entity?: string;
  name?: EntityName;
  icon?: string;
  show_name?: boolean;
  show_icon?: boolean;
  show_state?: boolean;
  icon_height?: string;
  color?: string;
  state_color?: boolean;
  state_background?: boolean;
  background_opacity?: number;
  icon_on?: string;
  icon_off?: string;
  switch_style?: boolean;
  switch_animation?: string;
  switch_text_color?: string;
  show_toggle?: boolean;
  toggle_color?: string;
  toggle_icon_on?: string;
  toggle_icon_off?: string;
  entity_picture?: string;
  show_entity_picture?: boolean;
  state_display?: string;
  animation?: string;
  visibility?: Record<string, any>[];
  span?: number;
  row_span?: number;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  /** Sub-buttons: tapping this button opens them as a menu. */
  buttons?: SegmentConfig[];
  menu_columns?: number;
  menu_open?: MenuGesture;
  menu_close_on_action?: boolean;
}

export type MenuGesture = "tap" | "hold" | "double_tap";

export type MenuBack =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right"
  | "start"
  | "end"
  | "none";

export interface SplitButtonCardConfig {
  type: string;
  buttons: SegmentConfig[];
  columns?: number;
  divider?: DividerMode;
  divider_width?: string;
  divider_color?: string;
  gap?: string;
  show_name?: boolean;
  show_icon?: boolean;
  show_state?: boolean;
  icon_height?: string;
  color?: string;
  state_color?: boolean;
  state_background?: boolean;
  background_opacity?: number;
  show_entity_picture?: boolean;
  animation?: string;
  state_display?: string;
  switch_style?: boolean;
  switch_animation?: string;
  switch_text_color?: string;
  show_toggle?: boolean;
  toggle_color?: string;
  toggle_icon_on?: string;
  toggle_icon_off?: string;
  menu_timeout?: number;
  menu_back?: MenuBack | boolean;
  menu_back_icon?: string;
  menu_back_name?: string;
  menu_back_color?: string;
  menu_back_size?: string;
  menu_resize?: boolean;
  menu_close_on_action?: boolean;
}
