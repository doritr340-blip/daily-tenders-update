---
name: israeli-social-content
description: >-
  Write social media content for Israeli audiences in natural, native Hebrew
  (RTL) — Instagram, Facebook, TikTok, LinkedIn, WhatsApp/Telegram, and X.
  Use when the user asks for posts, captions, reels scripts, stories, ad copy,
  hashtags, or a content calendar aimed at an Israeli / Hebrew-speaking market,
  or mentions localizing marketing content for Israel. Handles local tone,
  slang, holidays, and platform norms — including sensitivity around memorial
  days and security periods.
license: Complete terms in LICENSE.txt
metadata:
  version: 1.2.0
  track: marketing-growth
  agent: claude-code
---

# Israeli Social Content

Produce social media content that reads as if written by a native Israeli social
manager — not translated-from-English Hebrew. The goal is copy a real Israeli
brand could publish today without an editor rewriting it.

## When to use this skill

Trigger on requests like:

- "Write an Instagram caption / reel script / story for an Israeli audience"
- "כתוב לי פוסט לפייסבוק / טיקטוק / לינקדאין"
- "Localize this campaign for Israel" / "תרגם ותאם את זה לקהל ישראלי"
- "Build a weekly content calendar for our Israeli followers"
- "Give me hashtags that actually work in Israel"
- Any marketing/growth copy where the end reader is Hebrew-speaking.

## Core principles

1. **Write Hebrew, don't translate it.** Idioms, word order, and rhythm must be
   native. If given English source, adapt the *intent*, not the sentences.
2. **RTL-correct output.** Hebrew is right-to-left. When numbers, Latin brand
   names, URLs, or emoji are mixed in, keep them readable and don't let
   punctuation drift to the wrong side. See `references/voice-and-language.md`.
3. **Match register to platform and audience.** TikTok ≠ LinkedIn. Gen-Z slang
   on a B2B post reads as trying too hard; corporate Hebrew on TikTok reads dead.
4. **Respect the calendar.** Israel's week, holidays, and especially its memorial
   days change what is appropriate to post. Check `references/calendar.md` before
   scheduling or writing anything tied to a date.
5. **Default to gender-aware phrasing.** Hebrew is gendered. Decide who is being
   addressed (specific person, mixed crowd, a brand persona) and stay consistent.

## Workflow

1. **Clarify the brief** (only if genuinely missing): platform, goal
   (awareness / engagement / clicks / sales), brand voice, target gender/age,
   and any product facts. If the user gave enough, proceed.
2. **Pick register + format** using `references/platforms.md` for the target
   platform (length, hook style, hashtag count, CTA norms, emoji density).
3. **Check the date** against `references/calendar.md`. Flag conflicts (e.g.
   don't run a celebratory sale on Yom HaZikaron) before producing copy.
4. **Draft in Hebrew** following `references/voice-and-language.md` for tone,
   slang, and RTL/typography rules.
5. **Add the platform furniture**: hook (first line), body, CTA, hashtags,
   and — if asked — alt text and a posting time suggestion.
6. **Offer variants.** For ad/caption work, give 2–3 distinct angles rather than
   one, so the user can A/B.

## Output format

Unless the user asks otherwise, return per piece:

- **Hook / first line** (the scroll-stopper)
- **Body** (Hebrew, RTL-clean)
- **CTA**
- **Hashtags** (platform-appropriate count)
- **Notes**: suggested posting time, visual idea, or A/B angle — kept short.

When producing multiple posts (a calendar), use a compact table: date, platform,
angle, hook, and status (draft).

## Reference files

Load these as needed — don't dump them into output:

- `references/platforms.md` — per-platform format, length, hashtag, and CTA norms.
- `references/calendar.md` — Israeli week, holidays, and sensitivity rules.
- `references/voice-and-language.md` — register, slang, RTL/typography, gender.

## Working with available tools

If the session has design/brand tooling connected, you can take content further:
- Brand voice & guidelines (AirOps brand kits) to ground tone before drafting.
- Visual assets (Canva / Figma / Gamma) to pair copy with a matching graphic.
- Gmail / Drive to deliver a calendar or hand off drafts.

Only reach for these when the user wants the asset or delivery — copy first.

## Guardrails

- Never publish or schedule anything externally without explicit confirmation.
- On national memorial days and during active security events, suppress
  promotional/celebratory tone by default and tell the user why.
- Don't fabricate product claims, prices, or statistics — ask or leave a
  clearly-marked placeholder like `[מחיר]`.
