/**
 * The complete set of Material Symbols ligatures this app renders.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Icons are rendered as a ligature font: `<span class="material-symbols-outlined">
 * potted_plant</span>`. The literal text IS the element's content; the font's
 * ligature table is what turns it into a glyph. So until the font is ready the
 * browser paints the raw WORD — there is no neutral placeholder to fall back to.
 *
 * The full Material Symbols variable font is ~4.0 MB (every icon Google ships).
 * We use the names below. Subsetting to exactly these produces ~73 KB, so the
 * font lands before the user can perceive a gap instead of ~20s later on a
 * mobile connection.
 *
 * WHY IT IS MAINTAINED BY HAND
 * ----------------------------
 * A build-time scrape of the source cannot see every name: 13 call sites choose
 * the ligature at runtime (`presentation.icon`, `getStatusIcon(t.status)`,
 * `revealed ? 'visibility_off' : 'visibility'`, ...). An icon missing from this
 * list is NOT a soft failure — it renders as its own name, in words, forever.
 *
 * ADDING AN ICON
 * --------------
 *   1. add the ligature here (keep the list sorted)
 *   2. `npm run build:icon-font` to regenerate public/fonts/
 *   3. commit the regenerated .woff2 alongside this file
 *
 * `icons.subset.test.ts` fails the build if a statically-written ligature is
 * missing from this list, which covers every case except the runtime ones.
 */
export const ICON_NAMES = [
  'account_balance',
  'account_balance_wallet',
  'account_circle',
  'add',
  'add_business',
  'add_circle',
  'arrow_back',
  'arrow_back_ios_new',
  'auto_awesome',
  'bar_chart',
  'calendar_month',
  'call',
  'campaign',
  'cancel',
  'check',
  'check_circle',
  'chevron_left',
  'chevron_right',
  'close',
  'content_copy',
  'dark_mode',
  'dashboard',
  'delete',
  'delete_forever',
  'description',
  'done_all',
  'download',
  'edit',
  'error',
  'event_upcoming',
  'expand_less',
  'expand_more',
  'family_restroom',
  'grid_view',
  'group',
  'help',
  'help_center',
  'help_outline',
  'history',
  'hourglass_top',
  'info',
  'insights',
  'lock',
  'logout',
  'mail',
  'manage_accounts',
  'manage_search',
  'more_vert',
  'notifications',
  'notifications_active',
  'payments',
  'person',
  'person_add',
  'person_off',
  'person_search',
  'photo_library',
  'potted_plant',
  'progress_activity',
  'receipt_long',
  'schedule',
  'school',
  'search',
  'settings',
  'support_agent',
  'sync',
  'sync_problem',
  'undo',
  'verified',
  'verified_user',
  'visibility',
  'visibility_off',
  'volume_off',
  'volume_up',
  'warning',
  'wifi_off',
  'zoom_in',
];

/** The variable-axis ranges index.css drives via `font-variation-settings`. */
export const ICON_AXES = 'opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';

/** Served from `public/`, so this path is stable and safe to `<link rel=preload>`. */
export const ICON_FONT_PATH = 'fonts/material-symbols-subset.woff2';
