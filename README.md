# Split Button Card

A Home Assistant dashboard card that looks exactly like the native **button card**, but is split into multiple sub-buttons. Every sub-button has its own icon, name and action.

```
┌──────────┬──────────┬──────────┐
│    💡    │    💡    │    🎨    │
│ Bed Light│ Ceiling  │  Szene   │
└──────────┴──────────┴──────────┘
```

## Installation

### HACS (custom repository)

1. HACS → ⋮ → *Custom repositories* → add this repository with type **Dashboard**.
2. Install **Split Button Card** and reload the browser.

### Manual

1. Download `split-button-card.js` from the latest release and copy it to `/config/www/`.
2. Settings → Dashboards → ⋮ → *Resources* → add `/local/split-button-card.js` as **JavaScript module**.

## Configuration

```yaml
type: custom:split-button-card
columns: 3
buttons:
  - entity: light.living_room
  - entity: light.kitchen
    name: Küche
  - name: Szene
    icon: mdi:palette
    tap_action:
      action: perform-action
      perform_action: scene.turn_on
      target:
        entity_id: scene.evening
```

### Card options

| Option          | Type    | Default                  | Description                                                                  |
| --------------- | ------- | ------------------------ | ---------------------------------------------------------------------------- |
| `buttons`       | list    | **required**             | The sub-buttons, see below.                                                  |
| `columns`       | number  | number of buttons        | Grid columns. Buttons wrap into additional rows.                             |
| `divider`       | string  | `border`                 | `border`: lines like the card border · `line`: short inset lines · `gap`: separate tiles · `none` |
| `divider_width` | string  | card border width        | Width of the divider lines (e.g. `2px`).                                     |
| `divider_color` | string  | card border color        | Color of the divider lines (any CSS color).                                  |
| `gap`           | string  | `8px`                    | Spacing for `divider: gap`.                                                  |
| `show_name`     | boolean | `true`                   | Default for all buttons.                                                     |
| `show_icon`     | boolean | `true`                   | Default for all buttons.                                                     |
| `show_state`    | boolean | `false`                  | Default for all buttons.                                                     |
| `icon_height`   | string  |                          | Default for all buttons.                                                     |

### Button options

| Option              | Type    | Default                                          | Description                                  |
| ------------------- | ------- | ------------------------------------------------ | -------------------------------------------- |
| `entity`            | string  |                                                  | Entity shown by this button.                 |
| `name`              | string  | entity friendly name                             | Text below the icon.                         |
| `icon`              | string  | entity icon                                      | Any `mdi:` icon.                             |
| `show_name`         | boolean | card setting                                     |                                              |
| `show_icon`         | boolean | card setting                                     |                                              |
| `show_state`        | boolean | card setting                                     | Show the entity state below the name.        |
| `icon_height`       | string  | card setting                                     | e.g. `48px`.                                 |
| `tap_action`        | action  | `toggle` for toggleable entities, else `more-info` | Standard [Home Assistant action](https://www.home-assistant.io/dashboards/actions/). |

## Development

```bash
npm install
npm run build        # → dist/split-button-card.js
npm run watch        # rebuild on change
./dev/start-ha.sh    # local Home Assistant with demo entities on :18123
```
