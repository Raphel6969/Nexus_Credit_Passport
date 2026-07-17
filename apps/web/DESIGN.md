# Nexus Credit Passport — Design System

> Extracted from Stitch Project `16264619811756566758` — "Nexus Credit Passport Dashboard"
> Design style: **Neumorphic (Soft UI)** · Font: **Inter** · Mode: **Dark**

---

## Color Palette

### Surface Colors
| Token | Hex | Usage |
|---|---|---|
| `surface` / `surface-dim` | `#0e1513` | Page background, base canvas |
| `surface-container-lowest` | `#090f0e` | Deepest shadow tone |
| `surface-container-low` | `#161d1b` | Very subtle elevation |
| `surface-container` | `#1a211f` | Card backgrounds |
| `surface-container-high` | `#252b2a` | Raised elements |
| `surface-container-highest` | `#2f3634` | Highest elevation surface |
| `surface-bright` | `#343b39` | Bright surface variant |
| `surface-variant` | `#2f3634` | Surface with tonal color |

### Primary — Teal
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#4fdbc8` | Primary interactive, active states |
| `primary-container` | `#14b8a6` | Filled primary containers |
| `on-primary` | `#003731` | Text on primary |
| `surface-tint` | `#4fdbc8` | Surface tint color |

### Secondary — Gold
| Token | Hex | Usage |
|---|---|---|
| `secondary` | `#e9c349` | Secondary actions, highlights |
| `secondary-container` | `#af8d11` | Filled secondary containers |
| `on-secondary` | `#3c2f00` | Text on secondary |

### On-Surface / Text
| Token | Hex | Usage |
|---|---|---|
| `on-surface` | `#dde4e1` | Primary text |
| `on-surface-variant` | `#bbcac6` | Secondary/muted text |
| `outline` | `#859490` | Standard borders |
| `outline-variant` | `#3c4947` | Subtle dividers |

### Error
| Token | Hex | Usage |
|---|---|---|
| `error` | `#ffb4ab` | Error states |
| `error-container` | `#93000a` | Error container |

---

## Neumorphic Shadow Tokens

| Class | Shadow Value | Use |
|---|---|---|
| `.neu-raised` | `12px 12px 24px #090f0e, -12px -12px 24px #1a211f` | Cards, panels |
| `.neu-inset` | `inset 6px 6px 12px #090f0e, inset -6px -6px 12px #1a211f` | Inputs, active buttons |
| `.neu-inset-focus` | Above + `0 0 0 2px #4fdbc8` | Focused inputs |

---

## Typography Scale

**Font Family**: `Inter` (all weights)

| Token | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|
| `display-lg` | 48px | 700 | 56px | -0.02em |
| `headline-lg` | 32px | 600 | 40px | -0.01em |
| `headline-lg-mobile` | 24px | 600 | 32px | — |
| `title-md` | 20px | 600 | 28px | — |
| `body-lg` | 16px | 400 | 24px | — |
| `body-sm` | 14px | 400 | 20px | — |
| `label-caps` | 12px | 700 | 16px | 0.05em |

---

## Spacing Scale

| Token | Value |
|---|---|
| `xs` | 4px |
| `sm` | 12px |
| `base` | 8px |
| `gutter` | 16px |
| `md` | 24px |
| `lg` | 40px |
| `xl` | 64px |
| `margin-mobile` | 20px |
| `margin-desktop` | 48px |

---

## Layout Grid

- **Desktop**: 12-column, 24px gutters, `max-width: 1280px`, 48px side margins
- **Mobile**: 4-column, 16px gutters, 20px side margins
- **Sidebar**: Fixed left, `288px` wide (`w-72`)
- **Top Bar**: Fixed top, `80px` tall (`h-20`), offset from sidebar

---

## Screens in Stitch Project

| Screen | ID |
|---|---|
| Dashboard (primary) | `336bfe6a713447d2852c81c0608ad52e` |
| Login / Consent Linking | `d5f572d5a7384f828e3bec23fa0afb78` |
| Share History | `48e57b5fb3f54db7924ff895650506a6` |
| Settings | `97086bce60484d0586b7217d653eef55` |
| Settings (Neumorphic) | `e70ea235bb8149f99f3dfa02d2b29cb8` |
| Mobile Dashboard | `f6430eb98c864226bfcc0c5efabf28ca` |
