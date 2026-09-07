import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { submitArtistAction } from "./actions";
import SubmitButton from "./SubmitButton";

export const metadata: Metadata = {
  title: "Submit Your Music",
  description: "Atlanta artists: submit your music and get featured on ThisIzATL.",
};

const inputClasses =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const labelClasses = "block text-sm font-medium text-zinc-700";

export default function SubmitPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Get Featured on ThisIzATL
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-zinc-600">
          Atlanta artist with new music out? Tell us about yourself below and
          we&rsquo;ll write you up. Submissions are reviewed before they go
          live, so make sure everything below is accurate.
        </p>

        <form
          action={submitArtistAction}
          encType="multipart/form-data"
          className="mt-8 space-y-5"
        >
          {/* Honeypot -- hidden from real visitors, bots fill every field blindly */}
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />

          <div>
            <label className={labelClasses}>Artist / Stage Name</label>
            <input type="text" name="artistName" required className={inputClasses} />
          </div>

          <div>
            <label className={labelClasses}>
              What pronouns should we use for you in the article?
            </label>
            <select name="pronouns" required defaultValue="" className={inputClasses}>
              <option value="" disabled>
                Select one
              </option>
              <option value="she/her">She/Her</option>
              <option value="he/him">He/Him</option>
              <option value="they/them">They/Them</option>
            </select>
          </div>

          <div>
            <label className={labelClasses}>Genre</label>
            <input
              type="text"
              name="genre"
              required
              placeholder="e.g. hip-hop, R&B, Afrobeat"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>
              How did you get started in music?
            </label>
            <textarea
              name="origin"
              required
              rows={3}
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>
              Who or what is your biggest inspiration?
            </label>
            <input
              type="text"
              name="biggestInspiration"
              required
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>What&rsquo;s New</label>
            <input
              type="text"
              name="whatsNew"
              required
              placeholder="New single, project, tour, announcement..."
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>
              What do you want listeners to take away from your music?
            </label>
            <textarea
              name="takeaway"
              required
              rows={3}
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Your Bio</label>
            <textarea
              name="bio"
              required
              rows={6}
              placeholder="Tell us about yourself and your music"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Instagram Link</label>
            <input
              type="url"
              name="instagramUrl"
              required
              placeholder="https://instagram.com/yourhandle"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Link to Your Music</label>
            <input
              type="url"
              name="musicUrl"
              required
              placeholder="Spotify, Apple Music, SoundCloud, YouTube..."
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>
              Anything else fans should know? (optional)
            </label>
            <textarea
              name="anythingElse"
              rows={3}
              placeholder="Upcoming shows, projects, plans..."
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Photo</label>
            <input
              type="file"
              name="photo"
              accept="image/*"
              required
              className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark"
            />
          </div>

          <SubmitButton />
        </form>
      </main>

      <SiteFooter />
    </div>
  );
}
