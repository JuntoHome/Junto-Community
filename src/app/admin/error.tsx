"use client";

import { useEffect } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ButtonLink, buttonClasses } from "@/components/ui/button";

// Shown inside the admin layout when an admin page fails to load, e.g. Supabase can't be reached.
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AdminPage
      title="Something went wrong."
      description="This page couldn't load. Please try again in a moment. Nothing you saved earlier is lost."
    >
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={buttonClasses("navy", "sm", "cursor-pointer")}>
          Try again
        </button>
        <ButtonLink href="/admin" variant="outline" size="sm">
          Admin home
        </ButtonLink>
      </div>
    </AdminPage>
  );
}
