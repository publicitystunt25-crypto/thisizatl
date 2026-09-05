import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms of use for ThisIzATL.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Terms &amp; Conditions
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: September 5, 2026</p>

        <div className="mt-8 space-y-8 text-[16px] leading-relaxed text-zinc-800">
          <p>
            Welcome to ThisIzATL (&ldquo;ThisIzATL,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; &ldquo;our&rdquo;). These Terms &amp; Conditions
            (&ldquo;Terms&rdquo;) govern your use of thisizatl.com and any
            related pages or services (the &ldquo;Site&rdquo;). By using the
            Site, you agree to these Terms. If you don&rsquo;t agree with
            them, please don&rsquo;t use the Site.
          </p>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              1. Acceptance of Terms
            </h2>
            <p className="mt-2">
              By accessing or using the Site, you agree to be bound by these
              Terms. We may update these Terms from time to time by posting a
              revised version on this page with a new &ldquo;Last
              updated&rdquo; date. Continued use of the Site after changes are
              posted means you accept the updated Terms. We may also
              restrict, suspend, or discontinue any part of the Site at any
              time, without notice.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              2. How to Contact Us
            </h2>
            <p className="mt-2">
              Questions, corrections, or legal notices related to the Site
              can be sent to{" "}
              <a
                href="mailto:info@thisizatl.com"
                className="text-brand-dark hover:underline"
              >
                info@thisizatl.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              3. Use of the Site
            </h2>
            <p className="mt-2">
              You may access and read content on the Site for personal,
              non-commercial use. You agree not to:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Republish, redistribute, or scrape Site content in bulk
                without our permission;
              </li>
              <li>
                Use the Site for any unlawful purpose, or in a way that could
                damage, disable, or impair it;
              </li>
              <li>
                Attempt to gain unauthorized access to the Site, its
                underlying systems, or any account on it;
              </li>
              <li>
                Misrepresent your affiliation with ThisIzATL or use our name,
                logo, or branding without permission.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              4. Our Content, Trademarks &amp; Copyright
            </h2>
            <p className="mt-2">
              The articles, graphics, logo, and design of the Site are owned
              by ThisIzATL or our licensors and are protected by copyright and
              other intellectual property laws. &ldquo;ThisIzATL&rdquo; and
              our logo are our marks. You may share links to our articles and
              quote brief excerpts with attribution, but you may not
              reproduce, republish, or otherwise use our content or branding
              for commercial purposes without our written permission.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              5. Third-Party Sources &amp; Links
            </h2>
            <p className="mt-2">
              ThisIzATL covers Atlanta news, music, and culture, and many of
              our posts are based on reporting from other outlets, which we
              credit and link to directly in each article. We don&rsquo;t
              control those third-party sites, and we&rsquo;re not
              responsible for their content, accuracy, or availability.
              Photos not credited to a specific photographer are sourced from
              Pexels and credited accordingly.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              6. Advertising
            </h2>
            <p className="mt-2">
              The Site may display advertising or sponsored content, which
              will be identified as such where required. Advertisers are
              solely responsible for the accuracy and legality of their own
              content. See our{" "}
              <a href="/advertise" className="text-brand-dark hover:underline">
                Advertise
              </a>{" "}
              page for details on working with us.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              7. No Warranties
            </h2>
            <p className="mt-2">
              The Site and its content are provided &ldquo;as is&rdquo; and
              &ldquo;as available,&rdquo; without warranties of any kind. We
              work to keep our reporting accurate and up to date, but we
              don&rsquo;t guarantee that the Site will be error-free,
              uninterrupted, or that every fact reported (including facts
              drawn from third-party sources) is complete or current.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              8. Limitation of Liability
            </h2>
            <p className="mt-2">
              To the fullest extent permitted by law, ThisIzATL will not be
              liable for any indirect, incidental, or consequential damages
              arising from your use of, or inability to use, the Site. Your
              use of the Site is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              9. Copyright Infringement Claims
            </h2>
            <p className="mt-2">
              If you believe content on the Site infringes your copyright,
              email{" "}
              <a
                href="mailto:info@thisizatl.com"
                className="text-brand-dark hover:underline"
              >
                info@thisizatl.com
              </a>{" "}
              with: (a) your contact information; (b) a description of the
              copyrighted work; (c) the URL of the material you believe
              infringes it; (d) a statement that you have a good-faith belief
              the use is unauthorized; and (e) a statement, under penalty of
              perjury, that the information is accurate and that you are the
              copyright owner or authorized to act on their behalf. We&rsquo;ll
              review and respond to valid requests promptly.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              10. Governing Law
            </h2>
            <p className="mt-2">
              These Terms are governed by the laws of the State of Georgia,
              without regard to its conflict-of-law principles.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              11. Severability
            </h2>
            <p className="mt-2">
              If any part of these Terms is found unenforceable, the rest
              will remain in full effect.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
