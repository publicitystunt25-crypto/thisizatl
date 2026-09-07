"use client";

import { useState } from "react";
import { submitArtistAction, submitOtherAction } from "./actions";
import SubmitButton from "./SubmitButton";

const inputClasses =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const labelClasses = "block text-sm font-medium text-zinc-700";

function Honeypot() {
  return (
    <input
      type="text"
      name="company"
      tabIndex={-1}
      autoComplete="off"
      className="absolute left-[-9999px] h-0 w-0 opacity-0"
      aria-hidden="true"
    />
  );
}

function FollowAndEmailFields() {
  return (
    <>
      <div>
        <label className={labelClasses}>Follow ThisIzATL on Instagram</label>
        <p className="mt-1 text-sm text-zinc-600">
          We tag and share everyone we feature —{" "}
          <a
            href="https://www.instagram.com/thisizatl"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-dark hover:underline"
          >
            follow @ThisizATL
          </a>{" "}
          so you don&rsquo;t miss it.
        </p>
        <div className="mt-2 flex gap-6 text-sm text-zinc-700">
          <label className="flex items-center gap-2">
            <input type="radio" name="followsInstagram" value="yes" />
            I&rsquo;m following
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="followsInstagram" value="no" />
            Not yet
          </label>
        </div>
      </div>

      <div>
        <label className={labelClasses}>
          Email address to contact you if your article is approved
        </label>
        <input
          type="email"
          name="submitterEmail"
          required
          placeholder="you@email.com"
          className={inputClasses}
        />
      </div>
    </>
  );
}

function ArtistFields() {
  return (
    <form action={submitArtistAction} encType="multipart/form-data" className="mt-8 space-y-5">
      <Honeypot />

      <div>
        <label className={labelClasses}>Artist / Stage Name</label>
        <input type="text" name="artistName" required className={inputClasses} />
      </div>

      <div>
        <label className={labelClasses}>Where are you from?</label>
        <input type="text" name="hometown" className={inputClasses} />
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
        <label className={labelClasses}>How did you get started in music?</label>
        <textarea name="origin" required rows={3} className={inputClasses} />
      </div>

      <div>
        <label className={labelClasses}>Who or what is your biggest inspiration?</label>
        <textarea name="biggestInspiration" required rows={3} className={inputClasses} />
      </div>

      <div>
        <label className={labelClasses}>
          What are you currently working on or have coming up?
        </label>
        <textarea
          name="whatsNew"
          required
          rows={3}
          placeholder="New single, project, tour, announcement..."
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>
          What do you want listeners to take away from your music?
        </label>
        <textarea name="takeaway" rows={3} className={inputClasses} />
      </div>

      <div>
        <label className={labelClasses}>Do you have a biography? (Optional)</label>
        <textarea
          name="bio"
          rows={6}
          placeholder="Tell us about yourself and your music"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>What is your Instagram username?</label>
        <input
          type="text"
          name="instagramUrl"
          placeholder="yourhandle or https://instagram.com/yourhandle"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Link to Your Music</label>
        <input
          type="url"
          name="musicUrl"
          placeholder="Spotify, Apple Music, SoundCloud, YouTube..."
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Anything else fans should know? (optional)</label>
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

      <FollowAndEmailFields />

      <SubmitButton />
    </form>
  );
}

function OtherFields() {
  return (
    <form action={submitOtherAction} encType="multipart/form-data" className="mt-8 space-y-5">
      <Honeypot />

      <div>
        <label className={labelClasses}>Name</label>
        <input type="text" name="name" required className={inputClasses} />
      </div>

      <div>
        <label className={labelClasses}>Where are you from?</label>
        <input type="text" name="hometown" className={inputClasses} />
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
        <label className={labelClasses}>What do you do professionally?</label>
        <input
          type="text"
          name="profession"
          required
          placeholder="e.g. chef, business owner, designer, community organizer"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>How did you get started?</label>
        <textarea name="origin" required rows={3} className={inputClasses} />
      </div>

      <div>
        <label className={labelClasses}>Who or what is your biggest inspiration?</label>
        <textarea name="biggestInspiration" required rows={3} className={inputClasses} />
      </div>

      <div>
        <label className={labelClasses}>
          What are you currently working on or have coming up?
        </label>
        <textarea
          name="whatsNew"
          required
          rows={3}
          placeholder="Launch, opening, project, announcement..."
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>What do you want people to take away from your work?</label>
        <textarea name="takeaway" rows={3} className={inputClasses} />
      </div>

      <div>
        <label className={labelClasses}>Do you have a biography? (Optional)</label>
        <textarea
          name="bio"
          rows={6}
          placeholder="Tell us about yourself and your work"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>What is your Instagram username?</label>
        <input
          type="text"
          name="instagramUrl"
          placeholder="yourhandle or https://instagram.com/yourhandle"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Link to Your Work</label>
        <input
          type="url"
          name="linkUrl"
          placeholder="Website, portfolio, menu, booking page..."
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Anything else we should know? (optional)</label>
        <textarea
          name="anythingElse"
          rows={3}
          placeholder="Upcoming events, launches, plans..."
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

      <FollowAndEmailFields />

      <SubmitButton />
    </form>
  );
}

export default function SubmitForm() {
  const [type, setType] = useState<"artist" | "other" | null>(null);

  return (
    <div className="mt-8">
      <div>
        <label className={labelClasses}>I am submitting as:</label>
        <div className="mt-2 flex gap-6 text-sm text-zinc-700">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="submitterType"
              checked={type === "artist"}
              onChange={() => setType("artist")}
            />
            An artist
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="submitterType"
              checked={type === "other"}
              onChange={() => setType("other")}
            />
            Someone else (business, entrepreneur, etc.)
          </label>
        </div>
      </div>

      {type === "artist" && <ArtistFields />}
      {type === "other" && <OtherFields />}
    </div>
  );
}
