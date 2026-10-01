import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { RichText, RichTextBlocks } from "@/components/ui/rich-text";
import { getEvent, getReview, getSiteSettings, listReviews } from "@/lib/content";
import type { BookReview, Event } from "@/lib/content/types";
import { formatEventDates } from "@/lib/format";
import { jsonLdScript, pageMetadata, reviewJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const reviews = await listReviews();
  return reviews.map((review) => ({ slug: review.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [review, site] = await Promise.all([getReview(slug), getSiteSettings()]);
  if (!review) return {};
  const metadata = pageMetadata(review.seo, review.path, site);
  // Keep the page out of search results until the review text is in.
  return review.body ? metadata : { ...metadata, robots: { index: false } };
}

/** "Back to the workshop / Register" box. */
function EventCta({ event, review }: { event: Event; review: BookReview }) {
  const dates = formatEventDates(event);
  return (
    <aside
      aria-label={`Back to ${event.name}`}
      className="flex flex-col gap-5 rounded-[18px] bg-navy px-6 py-7 text-white md:px-9 md:py-8"
    >
      <div>
        <p className="font-serif text-2xl text-gold-light md:text-[28px]">{event.name}</p>
        <p className="mt-1 text-base text-mist">
          {dates.monthDay} · {dates.timeRange} · with {review.book.author}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={event.path} variant="outline" size="md" className="border-white">
          ← Back to {event.code}
        </ButtonLink>
        <ButtonLink href={event.registration.url} variant="gold" size="md">
          {event.price === 0 ? "Register free" : "Register"}
        </ButtonLink>
      </div>
    </aside>
  );
}

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params;
  const [review, site] = await Promise.all([getReview(slug), getSiteSettings()]);
  if (!review) notFound();
  const event = await getEvent(review.eventSlug);

  return (
    <>
      {review.body && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(reviewJsonLd(review, site)) }}
        />
      )}

      <Container className="py-10 md:py-16 lg:py-20">
        <article className="mx-auto flex max-w-180 flex-col">
          {event && (
            <div className="mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-sand pb-5 md:mb-10">
              <Link href={event.path} className="text-[15px] font-semibold">
                ← Back to {event.name}
              </Link>
              <ButtonLink href={event.registration.url} variant="gold" size="sm">
                {event.price === 0 ? "Register free" : "Register"}
              </ButtonLink>
            </div>
          )}

          <Eyebrow>Book review</Eyebrow>
          <h1 className="mt-3 font-serif text-[40px] leading-[1.05] font-normal text-navy italic md:text-6xl">
            {review.book.title}
          </h1>
          {review.subtitle && (
            <p className="mt-2 font-serif text-2xl text-gold-text md:text-[32px]">{review.subtitle}</p>
          )}
          <p className="mt-3 text-lg text-slate md:text-xl">by {review.book.author}</p>
          {review.rating !== null && (
            <p className="mt-2 text-lg text-gold" aria-label={`Rated ${review.rating} out of 5`}>
              {"★".repeat(review.rating)}
              <span className="text-sand">{"★".repeat(5 - review.rating)}</span>
            </p>
          )}

          {review.intro ? (
            <p className="mt-7 rounded-xl bg-parchment px-5 py-4 text-base leading-relaxed text-ink md:px-6 md:py-5 md:text-[17px]">
              <RichText value={review.intro} />
            </p>
          ) : (
            <p className="mt-6 border-t border-sand pt-5 text-base text-muted">
              Reviewed by <strong className="font-semibold text-ink">{review.reviewer.name}</strong>,{" "}
              {review.reviewer.role}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-5 text-[17px] leading-[1.75] text-slate md:mt-10 md:text-lg">
            {review.body ? (
              <RichTextBlocks blocks={review.body} />
            ) : (
              <p data-placeholder className="rounded-xl bg-parchment px-6 py-5 text-base text-parchment-text">
                [REVIEW TEXT: pending]
              </p>
            )}
          </div>

          {review.sourceUrl && (
            <a
              href={review.sourceUrl}
              target="_blank"
              rel="noopener"
              className="mt-8 w-fit text-[15px] font-semibold underline underline-offset-2"
            >
              Read this review on Amazon<span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}

          {event && (
            <div className="mt-12 md:mt-16">
              <EventCta event={event} review={review} />
            </div>
          )}
        </article>
      </Container>
    </>
  );
}
