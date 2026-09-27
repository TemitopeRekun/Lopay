import { describe, it, expect } from "vitest";
import { ACTION_COLORS, ACTION_LABELS } from "./AuditLogsScreen";

/**
 * The frontend half of the `AuditAction` tripwire.
 *
 * Its mirror is `lopay-backend/src/audit/audit-actions.spec.ts`, which asserts
 * the same list against the real Prisma enum. Two halves rather than one,
 * because the enum and the screen that renders it live in different
 * repositories and neither build can see the other's source — the same shape as
 * `utils/claimUrl.ts` and the server's `enrollment-invites/claim-url.ts`, for
 * the same reason.
 *
 * ## What actually goes wrong without this
 *
 * Both maps fall back gracefully: an unmapped action renders as the raw
 * `SCREAMING_SNAKE_CASE` string in neutral grey. That is precisely why the
 * omission is worth a test — nothing throws, nothing looks broken, and the
 * platform operator is shown a consequential event styled as though the app had
 * judged it unremarkable. All five enrollment-invite actions shipped this way,
 * including `MIGRATED_PAYMENT_AMENDED`, which is a school restating money on a
 * live plan a family is already paying against.
 *
 * **Adding an action?** Add it here, to both maps in `AuditLogsScreen.tsx`, and
 * to the backend spec named above.
 */
const EVERY_AUDIT_ACTION = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_REJECTED",
  "PAYMENT_REVERSED",
  "FIRST_PAYMENT_CONFIRMED",
  "FIRST_PAYMENT_SETTLED",
  "FIRST_PAYMENT_REJECTED",
  "FIRST_PAYMENT_PAID",
  "ENROLLMENT_DEFAULTED",
  "PAYMENT_DISPUTED",
  "ENROLLMENT_INVITE_CREATED",
  "ENROLLMENT_INVITE_REVOKED",
  "ENROLLMENT_INVITE_DISPUTED",
  "ENROLLMENT_INVITE_CLAIMED",
  "ENROLLMENT_INVITE_RELEASED",
  "MIGRATED_PAYMENT_AMENDED",
  "MIGRATION_WINDOW_CHANGED",
] as const;

describe("audit log action rendering", () => {
  it.each(EVERY_AUDIT_ACTION)("labels %s", (action) => {
    expect(ACTION_LABELS[action]).toBeTruthy();
    // A label that is just the enum back again is the fallback wearing a
    // costume — it passes a `toBeTruthy` and tells the operator nothing.
    expect(ACTION_LABELS[action]).not.toBe(action);
  });

  it.each(EVERY_AUDIT_ACTION)("colours %s", (action) => {
    expect(ACTION_COLORS[action]).toBeTruthy();
  });

  it("maps exactly the same set of actions in both", () => {
    // Not merely "both cover the list": a key in one and not the other renders
    // a properly labelled entry in the unknown grey, or a grey-styled raw enum
    // with a real label. Either half alone is a partial fix.
    expect(Object.keys(ACTION_LABELS).sort()).toEqual(
      Object.keys(ACTION_COLORS).sort(),
    );
  });

  it("maps no action the backend cannot emit", () => {
    // Catches the other drift direction: an action renamed or removed on the
    // server leaves dead entries here that quietly never match again.
    expect(Object.keys(ACTION_LABELS).sort()).toEqual(
      [...EVERY_AUDIT_ACTION].sort(),
    );
  });

  it("marks a correction as something to notice, not as routine progress", () => {
    // MIGRATED_PAYMENT_AMENDED moves money on a live plan on nothing but the
    // school's say-so, and it is the reason this screen's colour map is worth
    // asserting rather than just its labels.
    expect(ACTION_COLORS.MIGRATED_PAYMENT_AMENDED).toContain("warning");
    expect(ACTION_COLORS.ENROLLMENT_INVITE_DISPUTED).toContain("danger");
  });
});
