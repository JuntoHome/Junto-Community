"use client";

import Link from "next/link";
import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses, textareaClasses } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { ProfileStatus } from "./admin-queries";
import { PUBLISH_FIELDS, type ProfileField, type ProfileFormState, type ProfileFormValues } from "./schema";
import { SLUG_MAX, slugify } from "./slug";

const LABELS: Record<ProfileField, string> = {
  name: "Organization name",
  slug: "Page address",
  tagline: "Tagline",
  intro: "Introduction",
  howTheyHelp: "How they can help",
  whoShouldExplore: "Who should explore",
  history: "Background",
  websiteUrl: "Website",
  contactName: "Contact name",
  contactRole: "Role",
  contactEmail: "Email",
  contactPhone: "Phone",
};

// "publish" marks what the database needs before a profile can go live (profiles_published_complete).
const TAGS = {
  required: { label: "Required", className: "bg-mist text-navy" },
  publish: { label: "Needed to publish", className: "bg-parchment text-parchment-text" },
} as const;

const fieldId = (field: ProfileField) => `profile-${field}`;

/** What the side panel ticks off: the name plus every "Needed to publish" field. */
const PUBLISH_CHECKLIST: ProfileField[] = ["name", ...PUBLISH_FIELDS];

const CHECKLIST_TEXT = {
  draft: {
    title: "Ready to publish?",
    note: "Drafts can be saved at any time. This list only matters for publishing.",
  },
  published: {
    title: "Must stay filled in",
    note: "This profile is on the public site, so these can't be left empty. Changes go live when you save.",
  },
};

/** While typing, keep a trailing hyphen so "score-" can go on to become "score-phoenix". */
function typedSlug(value: string) {
  const slug = slugify(value);
  return slug && /[\s_-]$/.test(value) ? `${slug}-` : slug;
}

type ControlProps = { id: string; name: ProfileField; "aria-describedby"?: string; "aria-invalid"?: true };

/** Label, optional tag and hint, the control, and the field's error. */
function Field({
  field,
  tag,
  hint,
  error,
  children,
}: {
  field: ProfileField;
  tag?: keyof typeof TAGS;
  hint?: ReactNode;
  error?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const id = fieldId(field);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base font-semibold text-ink">
        {LABELS[field]}
        {tag && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-bold tracking-[0.06em] uppercase",
              TAGS[tag].className,
            )}
          >
            {TAGS[tag].label}
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children({
        id,
        name: field,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {error && (
        <p id={errorId} className="text-[15px] font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-sand bg-white p-5 md:p-8">
      <fieldset className="min-w-0">
        <legend className="font-serif text-2xl font-bold text-navy">{title}</legend>
        {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
        <div className="mt-6 flex flex-col gap-6">{children}</div>
      </fieldset>
    </div>
  );
}

const code = "rounded bg-white/70 px-1 font-mono text-[14px]";

/** Every profile field, grouped as on the public page. Used to add a profile and to edit one. */
export function ProfileForm({
  action,
  initialValues,
  status,
  addressPrefix,
  submitLabel,
  cancelHref,
  className,
}: {
  action: (prev: ProfileFormState, formData: FormData) => Promise<ProfileFormState>;
  initialValues: ProfileFormValues;
  /** "new" while adding a profile. */
  status: "new" | ProfileStatus;
  /** Shown before the page address, e.g. "www.juntocommunity.org/who-can-help/". */
  addressPrefix: string;
  submitLabel: string;
  cancelHref: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initialValues });
  const { values, fieldErrors: errors = {}, message } = state;
  const errorFields = Object.keys(errors) as ProfileField[];

  // The page address follows the name until it's changed by hand. A published profile's
  // address stays put: changing it breaks links to the page.
  const published = status === "published";
  const [name, setName] = useState(values.name);
  const [slug, setSlug] = useState(values.slug || slugify(values.name));
  const [slugEdited, setSlugEdited] = useState(Boolean(values.slug) && values.slug !== slugify(values.name));

  // Fields of the checklist that have something in them, updated as the admin types.
  const [filled, setFilled] = useState(() => new Set(PUBLISH_CHECKLIST.filter((field) => values[field].trim())));
  const trackFilled = (event: FormEvent<HTMLFormElement>) => {
    const { name: field, value } = event.target as HTMLInputElement;
    if (!PUBLISH_CHECKLIST.includes(field as ProfileField)) return;
    setFilled((prev) => {
      const next = new Set(prev);
      if (value.trim()) next.add(field as ProfileField);
      else next.delete(field as ProfileField);
      return next;
    });
  };
  const done = filled.size;
  const checklist = CHECKLIST_TEXT[published ? "published" : "draft"];

  // After a save that didn't go through, take keyboard and screen reader users to the summary.
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.fieldErrors || state.message) summaryRef.current?.focus();
  }, [state]);

  const textInput = (control: ControlProps, props: ComponentProps<"input"> = {}) => (
    <input
      type="text"
      autoComplete="off"
      defaultValue={values[control.name]}
      className={inputClasses}
      {...control}
      {...props}
    />
  );
  const textArea = (control: ControlProps, rows: number) => (
    <textarea
      rows={rows}
      maxLength={20000}
      defaultValue={values[control.name]}
      className={textareaClasses}
      {...control}
    />
  );

  return (
    <form
      action={formAction}
      onInput={trackFilled}
      noValidate
      className={cn("grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem] xl:items-start", className)}
    >
      <div className="flex max-w-180 min-w-0 flex-col gap-6">
        {(errorFields.length > 0 || message) && (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border-2 border-red-700 bg-white p-5 focus:outline-none md:p-6"
          >
            <h2 className="text-lg font-bold text-red-700">
              {message ?? "The profile wasn't saved. Please fix the following:"}
            </h2>
            {errorFields.length > 0 && (
              <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-red-700">
                {errorFields.map((field) => (
                  <li key={field}>
                    <a
                      href={`#${fieldId(field)}`}
                      onClick={(event) => {
                        event.preventDefault();
                        document.getElementById(fieldId(field))?.focus();
                      }}
                      className="font-semibold text-red-700 underline hover:text-red-900"
                    >
                      {LABELS[field]}: {errors[field]}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Section title="The organization">
          <Field
            field="name"
            tag="required"
            hint="As the organization writes it, e.g. SCORE Greater Phoenix."
            error={errors.name}
          >
            {(control) =>
              textInput(control, {
                maxLength: 200,
                value: name,
                defaultValue: undefined,
                onChange: (event) => {
                  setName(event.target.value);
                  if (!published && !slugEdited) setSlug(slugify(event.target.value));
                },
              })
            }
          </Field>
          <Field
            field="slug"
            hint={
              published ? (
                <>
                  The page is at{" "}
                  <span className="font-semibold text-ink wrap-anywhere">{addressPrefix + initialValues.slug}</span>.{" "}
                  {slug && slug !== initialValues.slug ? (
                    <>
                      It will move to{" "}
                      <span className="font-semibold text-ink wrap-anywhere">{addressPrefix + slug}</span> when you
                      save, and links to the old address will stop working.
                    </>
                  ) : (
                    "If you change it, links to the old address will stop working."
                  )}
                </>
              ) : (
                <>
                  Filled in from the name; change it only if you need to. The page will be at{" "}
                  <span className="font-semibold text-ink wrap-anywhere">
                    {addressPrefix}
                    {slug || "…"}
                  </span>
                </>
              )
            }
            error={errors.slug}
          >
            {(control) =>
              textInput(control, {
                maxLength: SLUG_MAX,
                autoCapitalize: "none",
                spellCheck: false,
                value: slug,
                defaultValue: undefined,
                onChange: (event) => {
                  setSlugEdited(event.target.value.trim() !== "");
                  setSlug(typedSlug(event.target.value));
                },
                // Emptied: follow the name again. Otherwise drop a trailing hyphen.
                onBlur: () => setSlug(slugify(slug || name)),
              })
            }
          </Field>
          <Field
            field="tagline"
            tag="publish"
            hint="One line, shown under the name on the overview and on the profile."
            error={errors.tagline}
          >
            {(control) => textInput(control, { maxLength: 300 })}
          </Field>
        </Section>

        <Section title="Profile text">
          <details className="rounded-lg bg-parchment px-4 py-3 text-[15px] text-parchment-text">
            <summary className="cursor-pointer font-semibold">Formatting tips</summary>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
              <li>Leave a blank line between paragraphs.</li>
              <li>
                Start a line with <code className={code}>- </code> to make a bullet point.
              </li>
              <li>
                Put two stars around words to make them bold: <code className={code}>**free mentoring**</code>
              </li>
              <li>
                Write a link like this: <code className={code}>[SCORE&apos;s website](https://www.score.org)</code>
              </li>
            </ul>
          </details>
          <Field field="intro" tag="publish" hint="The opening paragraph or two." error={errors.intro}>
            {(control) => textArea(control, 5)}
          </Field>
          <Field
            field="howTheyHelp"
            tag="publish"
            hint="What they offer small-business owners."
            error={errors.howTheyHelp}
          >
            {(control) => textArea(control, 10)}
          </Field>
          <Field
            field="whoShouldExplore"
            tag="publish"
            hint="The owners and businesses who will get the most from them."
            error={errors.whoShouldExplore}
          >
            {(control) => textArea(control, 7)}
          </Field>
          <Field field="history" hint="Optional. Their history, if it helps readers trust them." error={errors.history}>
            {(control) => textArea(control, 6)}
          </Field>
        </Section>

        <Section title="Where to begin">
          <Field
            field="websiteUrl"
            tag="publish"
            hint="The page where visitors should start, e.g. https://www.score.org/phoenix."
            error={errors.websiteUrl}
          >
            {(control) =>
              textInput(control, { inputMode: "url", maxLength: 2000, autoCapitalize: "none", spellCheck: false })
            }
          </Field>
        </Section>

        <Section title="Point of contact" description="Optional. Shown at the end of the profile.">
          <div className="grid gap-6 md:grid-cols-2">
            <Field field="contactName" error={errors.contactName}>
              {(control) => textInput(control, { maxLength: 200 })}
            </Field>
            <Field field="contactRole" error={errors.contactRole}>
              {(control) => textInput(control, { maxLength: 200 })}
            </Field>
            <Field field="contactEmail" error={errors.contactEmail}>
              {(control) =>
                textInput(control, {
                  type: "email",
                  inputMode: "email",
                  maxLength: 254,
                  autoCapitalize: "none",
                  spellCheck: false,
                })
              }
            </Field>
            <Field field="contactPhone" error={errors.contactPhone}>
              {(control) => textInput(control, { type: "tel", inputMode: "tel", maxLength: 50 })}
            </Field>
          </div>
        </Section>

        {/* Stays in view at the bottom of the screen while scrolling through the form. */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-sand bg-ivory pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="submit" disabled={pending} className={buttonClasses("navy", "md", "cursor-pointer")}>
            {pending ? "Saving..." : submitLabel}
          </button>
          <Link href={cancelHref} className="font-semibold">
            Cancel
          </Link>
        </div>
      </div>

      {/* Wide screens: what's still missing before the profile can be published. */}
      <aside
        aria-label={checklist.title}
        className="hidden rounded-[18px] border border-sand bg-white p-5 xl:sticky xl:top-8 xl:block"
      >
        <h2 className="font-serif text-lg font-bold text-navy">{checklist.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {done} of {PUBLISH_CHECKLIST.length} needed fields filled in
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-green transition-[width] duration-300"
            style={{ width: `${(done / PUBLISH_CHECKLIST.length) * 100}%` }}
          />
        </div>
        <ul className="mt-4 flex flex-col gap-1">
          {PUBLISH_CHECKLIST.map((field) => {
            const ok = filled.has(field);
            return (
              <li key={field}>
                <button
                  type="button"
                  onClick={() => document.getElementById(fieldId(field))?.focus()}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md py-1 text-left text-[15px] text-ink hover:text-green"
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      ok ? "border-green bg-green text-white" : "border-field bg-white",
                    )}
                  >
                    {ok && <Icon name="check" size={13} strokeWidth={3} />}
                  </span>
                  {LABELS[field]}
                  <span className="sr-only">{ok ? " (filled in)" : " (still needed)"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 border-t border-sand pt-4 text-sm text-muted">{checklist.note}</p>
      </aside>
    </form>
  );
}
