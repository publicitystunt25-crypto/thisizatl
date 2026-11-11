import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ThisIzATL collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: November 10, 2026</p>

        <div className="mt-8 space-y-8 text-[16px] leading-relaxed text-zinc-800">
          <p>
            This policy explains what information ThisIzATL (&ldquo;we,&rdquo;
            &ldquo;us,&rdquo; &ldquo;our&rdquo;) collects through
            thisizatl.com (the &ldquo;Site&rdquo;) and our Facebook and
            Instagram accounts, how we use it, and the choices you have. By
            using the Site you agree to this policy.
          </p>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              1. Information We Collect
            </h2>
            <p className="mt-2">
              Reading the Site doesn&rsquo;t require an account, and we
              don&rsquo;t ask you for personal information to browse. We
              collect information only when you give it to us:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Artist and business submissions:</strong> your name,
                email address, hometown, bio, pronouns, Instagram handle and
                links, music or video links, photos, and anything else you
                choose to write in the submission form.
              </li>
              <li>
                <strong>Video clips:</strong> videos and related details you
                upload through our clip page.
              </li>
              <li>
                <strong>Nominations:</strong> the nominator&rsquo;s name and the
                nominee&rsquo;s name, email address, and Instagram handle.
              </li>
              <li>
                <strong>Coverage requests:</strong> your name, email address,
                phone number, company, what you want covered, links, press kit
                and other details, and any photos you attach to the request
                form.
              </li>
              <li>
                <strong>Email you send us:</strong> your address and whatever
                you include in the message.
              </li>
              <li>
                <strong>Staff and writer accounts:</strong> login details for
                people who write for or manage the Site.
              </li>
            </ul>
            <p className="mt-2">
              Like most web servers, our hosting provider may keep standard
              technical logs, such as IP address, browser type, and pages
              requested, for security and troubleshooting.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              2. How We Use Information
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                To review submissions and coverage requests and, if selected, publish articles,
                photos, and videos about you or your work;
              </li>
              <li>
                To post that content to our Facebook Page and Instagram
                account, including tagging the Instagram handle you gave us;
              </li>
              <li>
                To email you about your submission, a nomination, or a reply to
                your message;
              </li>
              <li>To operate, secure, and improve the Site.</li>
            </ul>
            <p className="mt-2">
              We don&rsquo;t sell your personal information.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              3. Public Content
            </h2>
            <p className="mt-2">
              If we publish an article, photo, or video that includes what you
              submitted, it becomes public on the Site and on social media. Your
              email address is used to contact you and isn&rsquo;t published.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              4. Service Providers
            </h2>
            <p className="mt-2">
              We use outside services to run the Site. They process information
              on our behalf and have their own privacy policies:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Render, for hosting;</li>
              <li>Supabase, for the database that stores submissions and articles;</li>
              <li>Resend, for sending email;</li>
              <li>Cloudinary, for storing and processing uploaded video;</li>
              <li>
                Anthropic, an AI service we use to help draft and edit articles
                and captions, which may receive submitted text and photos for
                that purpose;
              </li>
              <li>Pexels, for stock photography;</li>
              <li>
                Meta (Facebook and Instagram), where we publish content and
                read and reply to comments on our own posts.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              5. Facebook and Instagram
            </h2>
            <p className="mt-2">
              We publish to our own Facebook Page and Instagram account and may
              read and reply to comments on our posts. We use Meta&rsquo;s tools
              only for our own accounts and don&rsquo;t collect information
              about other Facebook or Instagram users beyond what appears
              publicly on our posts. Meta&rsquo;s own privacy policy governs
              what Meta collects when you use its services.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              6. Cookies
            </h2>
            <p className="mt-2">
              The Site uses a cookie only to keep staff and writers logged in.
              We don&rsquo;t use advertising or tracking cookies. Content
              embedded from other services, such as social media posts, may set
              their own cookies.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              7. Keeping Your Information
            </h2>
            <p className="mt-2">
              We keep submissions and published content for as long as we need
              them to run the Site, and we take reasonable steps to protect
              them. No method of storing or sending data is completely secure,
              so we can&rsquo;t guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              8. Your Choices and Deleting Your Data
            </h2>
            <p className="mt-2">
              You can ask us to see, correct, or delete the information you gave
              us, or to remove something we published about you. Email{" "}
              <a
                href="mailto:info@thisizatl.com"
                className="text-brand-dark hover:underline"
              >
                info@thisizatl.com
              </a>{" "}
              from the address you used and tell us what you&rsquo;d like done.
              We&rsquo;ll respond promptly. Content already shared on Facebook
              or Instagram may need to be removed there as well, and posts and
              Reels on Instagram can only be deleted by us in the app.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              9. Children
            </h2>
            <p className="mt-2">
              The Site isn&rsquo;t directed to children under 13, and we
              don&rsquo;t knowingly collect their personal information. If you
              believe a child has sent us information, contact us and we will
              delete it.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              10. Changes to This Policy
            </h2>
            <p className="mt-2">
              We may update this policy from time to time. The &ldquo;Last
              updated&rdquo; date above shows when it last changed, and
              continued use of the Site means you accept the update.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-ink">
              11. Contact
            </h2>
            <p className="mt-2">
              Questions about this policy can be sent to{" "}
              <a
                href="mailto:info@thisizatl.com"
                className="text-brand-dark hover:underline"
              >
                info@thisizatl.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
