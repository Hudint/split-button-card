export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  formatEntityState?: (stateObj: HassEntity) => string;
  [key: string]: any;
}

export interface ActionConfig {
  action: string;
  [key: string]: any;
}

export type DividerMode = "border" | "line" | "gap" | "none";

export interface SegmentConfig {
  entity?: string;
  name?: string;
  icon?: string;
  show_name?: boolean;
  show_icon?: boolean;
  show_state?: boolean;
  icon_height?: string;
  color?: string;
  state_color?: boolean;
  state_background?: boolean;
  background_opacity?: number;
  span?: number;
  row_span?: number;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

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
}
