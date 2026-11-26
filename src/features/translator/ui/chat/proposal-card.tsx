"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  briefChips,
  type Chip,
  CHIP_GROUP_NAMES,
  type ChipGroup,
  type ChipGroupView,
  focusAfterRemoval,
  hasAnyCriterion,
} from "../../criteria/chips";
import type { SearchBrief } from "../../criteria/schema";
import { PROPOSAL_TEXT } from "../../ai";
import { SwitchLink } from "../criteria-chooser";

/**
 * "Here's what I understood" (TR-45): the AI's proposal as groups of chips, with Confirm and
 * rank, Keep chatting and Edit in form. It only renders and forwards events: the chips and the
 * rules come from `criteria/chips.ts`, the state from `use-chat-session.ts`, and what Confirm
 * and Edit in form do from the Criteria step and the wizard.
 *
 * After a chip is removed, focus goes to the next chip's remove button (or the group's heading,
 * or the card's heading when the group is gone), and a live region says "Removed City: Phoenix."
 */
export function ProposalCard({
  proposal,
  onRemove,
  onConfirm,
  onKeepChatting,
  onEditInForm,
}: {
  proposal: SearchBrief;
  /** Removes one chip (its id from `briefChips(proposal)`). No AI call. */
  onRemove: (chipId: string) => void;
  /** Ranks `proposal` the way the form's Continue and Confirm and rank do. */
  onConfirm: () => void;
  /** Back to the message box. The card stays. */
  onKeepChatting: () => void;
  /** Opens the form filled in with `proposal`. */
  onEditInForm: () => void;
}) {
  const groups = briefChips(proposal);
  const canConfirm = hasAnyCriterion(proposal);
  const id = useId();
  const headingId = `${id}-heading`;
  const needsId = `${id}-needs`;
  const groupHeadingId = (group: ChipGroup) => `${id}-${group}`;

  const headingRef = useRef<HTMLHeadingElement>(null);
  const groupHeadings = useRef(new Map<ChipGroup, HTMLHeadingElement>());
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });

  // The chips before the last removal and the chip removed, so focus can move once the new
  // proposal has rendered.
  const removed = useRef<{ before: ChipGroupView[]; id: string } | null>(null);
  useEffect(() => {
    const last = removed.current;
    if (!last) return;
    removed.current = null;
    const target = focusAfterRemoval(last.before, briefChips(proposal), last.id);
    const element =
      target.to === "chip"
        ? removeButtons.current.get(target.id)
        : target.to === "group"
          ? groupHeadings.current.get(target.group)
          : headingRef.current;
    (element ?? headingRef.current)?.focus();
  }, [proposal]);

  function remove(chip: Chip) {
    removed.current = { before: groups, id: chip.id };
    onRemove(chip.id);
    setAnnouncement((a) => ({ text: PROPOSAL_TEXT.removed(chip.label), count: a.count + 1 }));
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-full min-w-0 flex-col gap-5 rounded-xl border border-navy bg-white p-4 text-base md:p-5"
    >
      <h4 id={headingId} ref={headingRef} tabIndex={-1} className="font-serif text-lg font-bold text-navy focus:outline-none">
        {PROPOSAL_TEXT.heading}
      </h4>

      {groups.map((group) => (
        <div key={group.group} className="flex min-w-0 flex-col gap-2">
          <h5
            id={groupHeadingId(group.group)}
            ref={(element) => {
              if (element) groupHeadings.current.set(group.group, element);
              else groupHeadings.current.delete(group.group);
            }}
            tabIndex={-1}
            className="text-base font-semibold text-navy focus:outline-none"
          >
            {CHIP_GROUP_NAMES[group.group]}
          </h5>
          {group.group === "assumptions" && <p className="text-sm text-muted">{PROPOSAL_TEXT.assumptionsHelp}</p>}
          {group.note && <p className="text-sm text-muted">{group.note}</p>}
          <ul aria-labelledby={groupHeadingId(group.group)} className="flex min-w-0 flex-wrap gap-2">
            {group.chips.map((chip) => (
              <li
                key={chip.id}
                className={
                  chip.removable
                    ? "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-sand bg-ivory py-1 pr-1 pl-3 text-ink"
                    : "inline-flex min-w-0 max-w-full items-center rounded-full border border-sand bg-ivory px-3 py-1.5 text-ink"
                }
              >
                <span className="min-w-0 wrap-anywhere">{chip.label}</span>
                {chip.removable && (
                  <button
                    type="button"
                    ref={(element) => {
                      if (element) removeButtons.current.set(chip.id, element);
                      else removeButtons.current.delete(chip.id);
                    }}
                    onClick={() => remove(chip)}
                    aria-label={PROPOSAL_TEXT.remove(chip.label)}
                    className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-navy hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy"
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex flex-col items-start gap-3 border-t border-sand pt-4">
        {!canConfirm && (
          <p id={needsId} className="font-medium text-red-700">
            {PROPOSAL_TEXT.needsCriterion}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            aria-describedby={canConfirm ? undefined : needsId}
            className={buttonClasses("navy", "md", "cursor-pointer")}
          >
            {PROPOSAL_TEXT.confirm}
          </button>
          <button type="button" onClick={onKeepChatting} className={buttonClasses("outline", "sm", "cursor-pointer")}>
            {PROPOSAL_TEXT.keepChatting}
          </button>
          <SwitchLink onClick={onEditInForm}>{PROPOSAL_TEXT.editInForm}</SwitchLink>
        </div>
      </div>

      <p role="status" className="sr-only">
        <span key={announcement.count}>{announcement.text}</span>
      </p>
    </section>
  );
}
