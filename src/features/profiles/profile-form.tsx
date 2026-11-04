"use client";

import Image from "next/image";
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
import { type ButtonVariant, buttonClasses } from "@/components/ui/button";
import { inputClasses, textareaClasses } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { ProfileStatus } from "./admin-queries";
import {
  FORM_FIELDS,
  type FormField,
  LOGO_TYPES,
  logoFileProblem,
  MAX_LINKS,
  PROFILE_LABELS,
  PUBLISH_FIELDS,
  type ProfileField,
  type ProfileFormState,
  type ProfileFormValues,
  type ProfileIntent,
} from "./schema";
import { SLUG_MAX, slugify } from "./slug";

// "publish" marks what the database needs before a profile can go live (profiles_published_complete).
const TAGS = {
  required: { label: "Required", className: "bg-mist text-navy" },
  publish: { label: "Needed to publish", className: "bg-parchment text-parchment-text" },
} as const;

const fieldId = (field: FormField) => `profile-${field}`;

/** What the side panel ticks off: the name plus every "Needed to publish" field. */
const PUBLISH_CHECKLIST: ProfileField[] = ["name", ...PUBLISH_FIELDS];

const CHECKLIST_TEXT = {
  draft: {
    title: "Ready to publish?",
    note: "You can save a draft at any time. Publish once all of these are filled in.",
  },
  published: {
    title: "Must stay filled in",
    note: "This profile is on the public site, so these can't be left empty. Changes go live when you save.",
  },
};

type SubmitButton = { intent: ProfileIntent; label: string; pendingLabel: string; variant: ButtonVariant };

// The first button is the one pressing Enter in a field uses, so Enter only ever saves.
const BUTTONS: Record<"draft" | "published", SubmitButton[]> = {
  draft: [
    { intent: "save", label: "Save draft", pendingLabel: "Saving...", variant: "outline" },
    { intent: "publish", label: "Publish", pendingLabel: "Publishing...", variant: "navy" },
  ],
  published: [
    { intent: "save", label: "Save changes", pendingLabel: "Saving...", variant: "navy" },
    { intent: "hide", label: "Hide from site", pendingLabel: "Hiding...", variant: "outline" },
  ],
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
        {PROFILE_LABELS[field]}
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
const hintCode = "rounded bg-sand/60 px-1 font-mono text-[13px] text-ink";

type ChosenLogo = { file: File; url: string };

/** The logo, saved with the rest of the form: a preview, and buttons to choose, replace or remove it. */
function LogoField({
  savedUrl,
  chosen,
  removing,
  error,
  disabled,
  onChoose,
  onRemove,
  onUndo,
}: {
  savedUrl: string | null;
  chosen: ChosenLogo | null;
  removing: boolean;
  error?: string;
  disabled: boolean;
  onChoose: (file: File) => void;
  onRemove: () => void;
  onUndo: () => void;
}) {
  const id = fieldId("logo");
  const shown = chosen?.url ?? (removing ? null : savedUrl);
  const ids = { hint: `${id}-hint`, status: `${id}-status`, error: `${id}-error` };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {PROFILE_LABELS.logo}
      </label>
      <p id={ids.hint} className="text-sm text-muted">
        Optional. A PNG, JPG or WebP image of 2 MB or less. A wide logo on a white or see-through background looks best.
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="relative flex h-20 w-64 max-w-full items-center justify-center rounded-lg border border-field bg-white">
          {shown ? (
            <Image
              src={shown}
              alt={chosen ? "New logo" : "Current logo"}
              fill
              unoptimized
              className="object-contain p-2"
            />
          ) : (
            <span className="text-sm text-muted">No logo</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* Hidden but focusable; the label below is its button. A chosen file is read here and kept in state. */}
          <input
            id={id}
            type="file"
            accept={LOGO_TYPES.join(",")}
            disabled={disabled}
            aria-describedby={[ids.hint, (chosen || removing) && ids.status, error && ids.error]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onChoose(file);
            }}
            className="peer sr-only"
          />
          <label
            htmlFor={id}
            className={buttonClasses(
              "outline",
              "sm",
              "cursor-pointer peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
            )}
          >
            {shown ? "Replace logo" : "Choose a logo"}
          </label>
          {shown && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="min-h-11 cursor-pointer font-semibold text-navy hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove logo
            </button>
          )}
        </div>
      </div>
      {(chosen || removing) && (
        <p id={ids.status} className="text-[15px] text-ink">
          {chosen ? (
            <>
              New logo chosen: <span className="font-semibold wrap-anywhere">{chosen.file.name}</span>. It&apos;s saved
              when you save the profile.
            </>
          ) : (
            "The logo will be removed when you save the profile."
          )}{" "}
          <button
            type="button"
            onClick={onUndo}
            disabled={disabled}
            className="cursor-pointer font-semibold text-navy underline underline-offset-2 disabled:cursor-not-allowed"
          >
            Undo
          </button>
        </p>
      )}
      {error && (
        <p id={ids.error} className="text-[15px] font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Every profile field, grouped as on the public page. Used to add a profile and to edit one. */
export function ProfileForm({
  action,
  initialValues,
  logoUrl = null,
  status,
  addressPrefix,
  cancelHref,
  className,
}: {
  /**
   * Gets the clicked button's intent as "intent" in the form data, a newly chosen logo
   * as "logo", and "removeLogo" = "1" to remove the current one.
   */
  action: (prev: ProfileFormState, formData: FormData) => Promise<ProfileFormState>;
  initialValues: ProfileFormValues;
  /** The saved logo's link, if it has one. */
  logoUrl?: string | null;
  /** "new" while adding a profile. */
  status: "new" | ProfileStatus;
  /** Shown before the page address, e.g. "www.juntocommunity.org/who-can-help/". */
  addressPrefix: string;
  cancelHref: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initialValues });
  const { values, fieldErrors: errors = {}, message } = state;
  const errorFields = FORM_FIELDS.filter((field) => errors[field]);
  // Which button was pressed, so it can say "Publishing..." while the others wait.
  const [intent, setIntent] = useState<ProfileIntent>("save");

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

  // The logo is sent with the form. A chosen file is kept here rather than in the file
  // input, which empties when the form resets, so it survives a save that didn't go through.
  const [newLogo, setNewLogo] = useState<ChosenLogo | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoProblem, setLogoProblem] = useState<string>();
  const changeLogo = (file: File | null, remove = false) => {
    if (newLogo) URL.revokeObjectURL(newLogo.url);
    setNewLogo(file && { file, url: URL.createObjectURL(file) });
    setRemoveLogo(remove);
    setLogoProblem(undefined);
  };
  const submit = (formData: FormData) => {
    if (newLogo) formData.set("logo", newLogo.file);
    else if (removeLogo) formData.set("removeLogo", "1");
    formAction(formData);
  };

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
      action={submit}
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
                      {PROFILE_LABELS[field]}: {errors[field]}
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
          <LogoField
            savedUrl={logoUrl}
            chosen={newLogo}
            removing={removeLogo}
            error={logoProblem ?? errors.logo}
            disabled={pending}
            onChoose={(file) => {
              const problem = logoFileProblem(file);
              if (problem) setLogoProblem(problem);
              else changeLogo(file);
            }}
            onRemove={() => changeLogo(null, Boolean(logoUrl))}
            onUndo={() => changeLogo(null)}
          />
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
            field="worthExploring"
            tag="publish"
            hint="One or two memorable reasons to explore them."
            error={errors.worthExploring}
          >
            {(control) => textArea(control, 8)}
          </Field>
          <Field
            field="peopleToKnow"
            tag="publish"
            hint="Who to talk to, or how to get introduced, e.g. a mentor through their request process."
            error={errors.peopleToKnow}
          >
            {(control) => textArea(control, 5)}
          </Field>
        </Section>

        <Section title="Getting started" description="Shown together in a box near the end of the profile.">
          <Field
            field="gettingStarted"
            tag="publish"
            hint="A practical first step, e.g. which page to start on or how to request an appointment."
            error={errors.gettingStarted}
          >
            {(control) => textArea(control, 5)}
          </Field>
          <Field
            field="websiteUrl"
            tag="publish"
            hint="The page where visitors should start. Shown as a button, e.g. https://www.score.org/az/greater-phoenix/."
            error={errors.websiteUrl}
          >
            {(control) =>
              textInput(control, { inputMode: "url", maxLength: 2000, autoCapitalize: "none", spellCheck: false })
            }
          </Field>
          <Field
            field="links"
            hint={
              <>
                Optional. One web address per line, up to {MAX_LINKS}. Listed at the end of the profile. To show words
                instead of the address, write <code className={hintCode}>[Workshops](https://...)</code>
              </>
            }
            error={errors.links}
          >
            {(control) => (
              <textarea
                rows={4}
                defaultValue={values.links}
                autoCapitalize="none"
                spellCheck={false}
                className={textareaClasses}
                {...control}
              />
            )}
          </Field>
        </Section>

        <Section title="Point of contact" description="Optional. Shown in the Getting started box.">
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
          {BUTTONS[published ? "published" : "draft"].map((button) => (
            <button
              key={button.intent}
              type="submit"
              name="intent"
              value={button.intent}
              disabled={pending}
              onClick={() => setIntent(button.intent)}
              className={buttonClasses(button.variant, "md", "cursor-pointer")}
            >
              {pending && intent === button.intent ? button.pendingLabel : button.label}
            </button>
          ))}
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
                  {PROFILE_LABELS[field]}
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
