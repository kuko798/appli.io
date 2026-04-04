/**
 * Pure helpers for resume diagnose / optimize (unit-testable, no PDF or LLM).
 */

/** Enough for several jobs + leadership blocks; ~2–3k tokens. Was 1800 and truncated most resumes to one role. */
export const RESUME_CRITIQUE_CHAR_LIMIT = 26000;
export const RESUME_OPTIMIZE_CHAR_LIMIT = 14000;

export const SUMMARY_CARD_LABELS = {
    structural_integrity: 'Structure & layout',
    signal_strength: 'Overall signal',
    impact_specificity: 'Impact & specificity',
    tech_arity: 'Impact & specificity',
};

export function scoreColor(r) {
    return r >= 8 ? '#10b981' : r >= 5 ? '#f59e0b' : '#f87171';
}

export function stripCodeFences(text) {
    let t = (text || '').trim();
    t = t.replace(/^```(?:plaintext|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return t;
}

const SKILL_JUNK_BRANDS = [
    'Apple',
    'Google',
    'TikTok',
    'OpenAI',
    'Meta',
    'NVIDIA',
    'Salesforce',
    'Amazon',
    'Netflix',
    'Spotify',
];

function countJunkBrandHits(line) {
    let n = 0;
    for (const w of SKILL_JUNK_BRANDS) {
        if (new RegExp(`\\b${w}\\b`, 'i').test(line)) n += 1;
    }
    return n;
}

/** Drop standalone lines that are mostly junk brand names (not Programming:/Tools: rows or bullets). */
export function stripConsumerBrandSkillNoise(text) {
    const lines = (text || '').split('\n');
    const out = [];
    for (const line of lines) {
        const t = line.trim();
        if (!t) {
            out.push(line);
            continue;
        }
        if (/^(Programming|Tools)\s*:/i.test(t) || t.startsWith('•')) {
            out.push(line);
            continue;
        }
        const hits = countJunkBrandHits(t);
        if (hits >= 3 && !t.includes(':')) {
            continue;
        }
        out.push(line);
    }
    return out.join('\n');
}

export function collapseExcessBlankLines(text) {
    return (text || '')
        .replace(/\n{4,}/g, '\n\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

export function cleanOptimizedOutput(raw) {
    let t = stripCodeFences(raw);
    t = stripConsumerBrandSkillNoise(t);
    t = collapseExcessBlankLines(t);
    return t;
}

export function wordCount(s) {
    return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

/** Surface FastAPI `detail` from failed LLM responses (status on err from LocalLLM). */
export function llmErrorMessage(err) {
    let m = err?.message || 'Request failed';
    const raw = err?.responseText;
    if (raw && typeof raw === 'string') {
        try {
            const j = JSON.parse(raw);
            if (typeof j.detail === 'string') return j.detail;
            if (Array.isArray(j.detail)) {
                const parts = j.detail.map((d) => (typeof d === 'object' && d?.msg ? d.msg : String(d)));
                if (parts.length) return parts.join('; ');
            }
        } catch {
            if (raw.length < 400) m = raw;
        }
    }
    if (err?.status === 500) {
        m = `${m} If the LLM is local, check the terminal running pytorch_chat_server for errors.`;
    }
    return m;
}

export function normalizeKeys(obj) {
    if (Array.isArray(obj)) return obj.map(normalizeKeys);
    if (obj && typeof obj === 'object') {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), normalizeKeys(v)]));
    }
    return obj;
}

function toScore(v) {
    return v && typeof v === 'object'
        ? { rating: clampRating(v.rating, 0, 0), advice: String(v.advice || '').trim() }
        : { rating: 0, advice: '' };
}

function clampRating(value, fallback = 1, min = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(10, Math.round(n)));
}

function looksGenericDuty(text) {
    return /\b(responsible for|duties included|worked on|helped with|assisted with|tasked with)\b/i.test(text);
}

function hasOutcomeSignal(text) {
    return /\b(increase|improve|reduc|save|grew|boost|cut|achiev|deliver|launched|won|retention|conversion|efficiency|accuracy|revenue|satisfaction|quality)\w*\b/i.test(
        text,
    );
}

function hasActionVerb(text) {
    return /^(led|built|created|developed|implemented|managed|coordinated|designed|executed|drove|owned|automated|optimized|delivered|trained|supported|analyzed|improved|reduced|increased)\b/i.test(
        String(text || '').trim(),
    );
}

function estimateBulletRatingFromText(text) {
    const t = String(text || '').trim();
    if (!t) return 1;
    let score = 2;
    if (hasActionVerb(t)) score += 1;
    if (/\d/.test(t)) score += 2;
    if (/%|\$|k\b|m\b|million|billion|quarter|month|week|year|yrs?\b/i.test(t)) score += 1;
    if (hasOutcomeSignal(t)) score += 2;
    if (t.split(/\s+/).length >= 9) score += 1;
    if (looksGenericDuty(t)) score -= 2;
    return clampRating(score, 1);
}

function summaryLooksLikePlaceholder(s) {
    const a = toScore(s.structural_integrity);
    const b = toScore(s.signal_strength);
    const c = toScore(s.impact_specificity);
    return (
        a.rating === 0 &&
        b.rating === 0 &&
        c.rating === 0 &&
        !a.advice &&
        !b.advice &&
        !c.advice
    );
}

/**
 * Turn model JSON (any key casing) into dashboard report shape — same rules as ResumeOptimizer.fetchCritique.
 * If the model echoed example zeros with empty advice, derive summary scores from bullet ratings.
 */
export function buildReportDataFromCritiqueJson(json) {
    const raw = normalizeKeys(json);
    const summary = raw.summary || {};
    const experiences = (raw.experiences || [])
        .map((exp) => ({
            role_at_company: exp.role_at_company || 'Experience',
            analysis: (exp.analysis || [])
                .map((a) => ({
                    original_bullet: a.original_bullet || '',
                    rating: clampRating(a.rating, 1),
                    critique: a.critique || '',
                    suggestions: Array.isArray(a.suggestions) ? a.suggestions.filter(Boolean) : [],
                }))
                .filter((a) => a.original_bullet),
        }))
        .filter((exp) => exp.analysis.length > 0);

    const rawBulletRatings = experiences.flatMap((e) => e.analysis.map((a) => a.rating)).filter((r) => r > 0);
    const hasLowVariance = rawBulletRatings.length >= 3 && new Set(rawBulletRatings).size <= 1;
    if (hasLowVariance) {
        for (const exp of experiences) {
            for (const bullet of exp.analysis) {
                bullet.rating = estimateBulletRatingFromText(bullet.original_bullet);
            }
        }
    }

    const impactSpec = summary.impact_specificity ?? summary.tech_arity;
    let summaryOut = {
        structural_integrity: toScore(summary.structural_integrity),
        signal_strength: toScore(summary.signal_strength),
        impact_specificity: toScore(impactSpec),
    };

    const finalBulletRatings = experiences.flatMap((e) => e.analysis.map((a) => a.rating)).filter((r) => r > 0);
    if (finalBulletRatings.length > 0 && summaryLooksLikePlaceholder(summaryOut)) {
        const m = Math.min(10, Math.max(1, Math.round(finalBulletRatings.reduce((x, y) => x + y, 0) / finalBulletRatings.length)));
        const note = 'Overall scores estimated from bullet ratings (model left summary at zero).';
        summaryOut = {
            structural_integrity: { rating: m, advice: note },
            signal_strength: { rating: m, advice: note },
            impact_specificity: { rating: m, advice: note },
        };
    }

    return {
        summary: summaryOut,
        experiences,
        upgrade_path: (raw.upgrade_path || []).filter(Boolean),
    };
}

/**
 * Strip sections that aren't useful for bullet critique (contact info, education,
 * skills lists, objective/summary blurbs). Returns only experience-heavy content,
 * then hard-truncates to RESUME_CRITIQUE_CHAR_LIMIT characters.
 */
export function sliceForCritiquePrompt(text) {
    const SKIP_HEADERS =
        /^\s*(contact|references|education|(?:technical\s+)?skills?|certifications?|languages?|interests?|hobbies|objective|summary|profile|about)\s*:?\s*$/i;

    /** Avoid matching "Experience with X" in a sentence; allow section titles only. */
    function isExperienceSectionHeader(trimmed) {
        if (/^\s*experience\s*:?\s*$/i.test(trimmed)) return true;
        return /^\s*(professional\s+experience|relevant\s+experience|work\s+experience|work\s+history|employment(\s+history)?|internships?|volunteer|leadership|projects?)\s*:?\s*$/i.test(
            trimmed,
        );
    }

    const lines = String(text || '').split('\n');
    const out = [];
    let inSkipSection = true; // skip everything before the first experience section
    let inExperience = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (isExperienceSectionHeader(trimmed)) {
            inExperience = true;
            inSkipSection = false;
            out.push(line);
            continue;
        }
        if (SKIP_HEADERS.test(trimmed)) {
            inExperience = false;
            inSkipSection = true;
            continue;
        }
        if (!inSkipSection || inExperience) {
            out.push(line);
        }
    }

    // If stripping left very little, fall back to raw text
    const stripped = out.join('\n').trim();
    const source = stripped.length > 200 ? stripped : String(text || '').trim();
    return source.slice(0, RESUME_CRITIQUE_CHAR_LIMIT);
}

export function sliceForOptimizePrompt(text) {
    return String(text || '').trim().slice(0, RESUME_OPTIMIZE_CHAR_LIMIT);
}

/**
 * Lines like "IBM, Madison, WI" or "Enterprise Mobility, Saint Louis, MO" (not bullets, end with ", ST").
 */
export function looksLikeOrgLocationLine(trimmed) {
    const t = String(trimmed || '').trim();
    if (!t || /^\s*[•\-\*➤▪]/.test(t)) return false;
    if (t.length < 8 || t.length > 130) return false;
    if (!t.includes(',')) return false;
    return /,\s*[A-Z]{2}\s*$/.test(t);
}

const MONTH_RE =
    '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

/**
 * PDF parsers often put "IBM May 2026 – Present" on one line (company + date), not "IBM, Madison, WI".
 */
export function looksLikeCompanyDateLine(trimmed) {
    const t = String(trimmed || '').trim();
    if (!t || /^\s*[•\-\*➤▪]/.test(t)) return false;
    if (t.length < 10 || t.length > 160) return false;
    const re = new RegExp(
        `\\b${MONTH_RE}\\s+\\d{4}\\s*[-–—]\\s*(?:${MONTH_RE}\\s+\\d{4}|Present|Current)\\b`,
        'i',
    );
    const m = re.exec(t);
    if (!m) return false;
    // Standalone date lines ("May 2026 – Present") are not job headers; require company text before the span.
    const prefix = t.slice(0, m.index).trim();
    return prefix.length >= 2 && /[A-Za-z0-9]/.test(prefix);
}

function stripLeadingSectionHeaders(parts) {
    let p = parts;
    while (
        p.length &&
        /^(professional\s+)?experience|relevant\s+experience|experience|leadership|employment(\s+history)?|work\s+history|internships?|volunteer|projects?$/i.test(
            p[0],
        )
    ) {
        p = p.slice(1);
    }
    return p;
}

function jobBlockHasBody(lines) {
    const parts = stripLeadingSectionHeaders(lines.map((l) => l.trim()).filter(Boolean));
    return parts.length >= 2;
}

/** Section headers that separate groups of jobs (Leadership, Projects, etc.) */
function isSectionBreakLine(trimmed) {
    return /^(leadership|volunteer|projects?|activities|extracurricular|community)\s*:?\s*$/i.test(
        String(trimmed || '').trim(),
    );
}

/**
 * A title+city line ("Software Engineer Intern Saint Louis, MO") looks like an org-location
 * line because it ends with ", ST". Reject it if it starts with a known title word.
 */
function looksLikeJobTitleLine(trimmed) {
    return /^(software|senior|junior|lead|staff|principal|intern|co-|co\s|incoming|associate|assistant|director|manager|engineer|developer|analyst|designer|consultant|president|vice|treasurer|secretary|chair|founder|head|advisor|coordinator|specialist|technician|scientist|architect|administrator|officer)\b/i.test(
        trimmed,
    );
}

/**
 * Split experience-heavy text into one string per employer/org block.
 *
 * Strategy:
 * 1. Prefer splitting on company-date lines ("IBM May 2026 – Present") — these are
 *    unambiguous job starts.
 * 2. A title+city line ("Software Engineer Intern Saint Louis, MO") that immediately
 *    follows a company-date line is part of that block — do NOT flush there.
 * 3. For classic resumes with "Company, City, ST" format (no inline dates), fall back
 *    to splitting on org-location lines, but only when the previous line was NOT a
 *    company-date line (to avoid splitting title lines).
 */
export function splitExperienceIntoJobBlocks(experienceText) {
    const rawLines = String(experienceText || '').split('\n');

    // First pass: does this text have any company-date lines?
    const hasDateLines = rawLines.some(l => looksLikeCompanyDateLine(l.trim()));

    const blocks = [];
    let current = [];
    let prevWasCompanyDate = false;

    const flush = () => {
        const joined = current.join('\n').trim();
        if (joined) blocks.push(joined);
        current = [];
    };

    for (const line of rawLines) {
        const trimmed = line.trim();
        const isCompanyDate = looksLikeCompanyDateLine(trimmed);
        const isOrgLocation = looksLikeOrgLocationLine(trimmed);
        const isSectionBreak = isSectionBreakLine(trimmed);

        if (isSectionBreak && jobBlockHasBody(current)) {
            flush();
        } else if (isCompanyDate && jobBlockHasBody(current)) {
            // Unambiguous new job start
            flush();
        } else if (
            isOrgLocation &&
            !looksLikeJobTitleLine(trimmed) &&  // not a title+city line
            !prevWasCompanyDate &&               // not the line right after a company-date
            !hasDateLines &&                     // only use as splitter when no date-style lines exist
            jobBlockHasBody(current)
        ) {
            flush();
        }

        current.push(line);
        prevWasCompanyDate = isCompanyDate;
    }
    flush();
    return blocks.length ? blocks : [String(experienceText || '').trim()].filter(Boolean);
}

/**
 * Wrap blocks with markers so the model must return one experiences[] entry per employer.
 * Each block header also extracts the best guess at company + title to help the model.
 */
export function formatSegmentedBlocksForCritiquePrompt(experienceText) {
    const blocks = splitExperienceIntoJobBlocks(experienceText);
    if (blocks.length <= 1) {
        return { text: experienceText, blockCount: Math.max(1, blocks.length) };
    }

    const numbered = blocks.map((b, i) => {
        const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
        // First non-empty line is usually "Company Month YYYY – Date" or "Company, City, ST"
        const companyLine = lines[0] || '';
        // Second non-empty line is usually "Title City, ST"
        const titleLine = lines[1] || '';
        // Strip trailing "City, ST" from title line.
        // Only strip the last 1–2 words that form "City, ST" — not greedy into the title itself.
        // Matches: " Madison, WI" or " Saint Louis, MO" at end of string.
        const titleOnly = titleLine
            .replace(/\s+(?:[A-Z][a-z]+\s+)?[A-Z][a-z]+,\s*[A-Z]{2}\s*$/, '')
            .trim();
        // Strip date range from company line to get company name
        const companyOnly = companyLine
            .replace(/\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}.*/i, '')
            .trim();

        const hint = titleOnly && companyOnly
            ? ` [HINT: role_at_company = "${titleOnly}, ${companyOnly}"]`
            : '';

        return `>>> JOB_BLOCK ${i + 1} OF ${blocks.length}${hint} — use ONLY the bullets inside this block <<<\n${b.trim()}`;
    });

    return {
        text: numbered.join('\n\n---\n\n'),
        blockCount: blocks.length,
    };
}

function normalizeBulletText(text) {
    return String(text || '')
        .replace(/^\s*(?:[•●◦▪◉*-]|â€¢)\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function bulletKey(text) {
    return normalizeBulletText(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function extractBulletsFromBlock(blockText) {
    const lines = String(blockText || '').split('\n');
    const bullets = [];
    let current = '';

    const pushCurrent = () => {
        const b = normalizeBulletText(current);
        if (b) bullets.push(b);
        current = '';
    };

    for (const line of lines) {
        const t = line.trim();
        if (!t) {
            if (current) pushCurrent();
            continue;
        }
        if (/^(?:[•●◦▪◉*-]|â€¢)\s+/.test(t)) {
            if (current) pushCurrent();
            current = normalizeBulletText(t);
            continue;
        }
        if (current) {
            // Preserve PDF-wrapped bullet continuations ("... efficiently" + "manage 300+ users ...")
            current = `${current} ${normalizeBulletText(t)}`.trim();
        }
    }
    if (current) pushCurrent();
    return bullets;
}

function extractHintRoleFromMarkerLine(line) {
    const t = String(line || '');
    const m = t.match(/\[HINT:\s*role_at_company\s*=\s*"([^"]+)"\]/i);
    return m ? m[1].trim() : '';
}

function inferRoleAtCompanyFromBlock(blockText, fallbackLabel = '') {
    const lines = String(blockText || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    if (!lines.length) return fallbackLabel;

    const companyLine = lines[0] || '';
    const titleLine = lines[1] || '';
    const titleOnly = titleLine
        .replace(/\s+(?:[A-Z][a-z]+\s+)?[A-Z][a-z]+,\s*[A-Z]{2}\s*$/, '')
        .trim();
    const companyOnly = companyLine
        .replace(/\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}.*/i, '')
        .trim();
    if (titleOnly && companyOnly) return `${titleOnly}, ${companyOnly}`;
    if (companyOnly) return companyOnly;
    return fallbackLabel || 'Experience';
}

function extractBlocksFromSegmentedCritiqueText(segmentedText, expectedCount = 1) {
    const src = String(segmentedText || '');
    if (!src.includes('>>> JOB_BLOCK')) {
        return [{ text: src, hintRole: '' }];
    }
    const parts = src
        .split(/\n\s*---\s*\n/g)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
            const lines = p.split('\n');
            const hintRole = extractHintRoleFromMarkerLine(lines[0] || '');
            if (lines[0] && lines[0].includes('>>> JOB_BLOCK')) {
                return { text: lines.slice(1).join('\n').trim(), hintRole };
            }
            return { text: p, hintRole: '' };
        });
    if (parts.length >= expectedCount) return parts.slice(0, expectedCount);
    while (parts.length < expectedCount) parts.push({ text: '', hintRole: '' });
    return parts;
}

function fallbackCritiqueForRating(rating) {
    if (rating >= 8) return 'Strong bullet; tighten wording and name context to make the impact easier to scan quickly.';
    if (rating >= 5) return 'Clarify scope and outcome so the value of this work is immediately obvious to recruiters.';
    return 'Replace generic wording with concrete action, scope, and result details already true for this work.';
}

function fallbackSuggestionsForBullet(bullet) {
    const base = normalizeBulletText(bullet).replace(/[.]+$/, '');
    return [
        `${base}; add concrete scope and who benefited from the work.`,
        `${base}; keep facts and add a measurable result or timeframe if known.`,
    ];
}

/**
 * Ensure every expected bullet receives analysis feedback even if the model under-returns.
 * This is a post-processing guard only; it does not change upstream bullet parsing logic.
 */
export function enforceCritiqueBulletCoverage(json, segmentedCritiqueText, blockCount = 1) {
    const raw = normalizeKeys(json || {});
    const expectedBlocks = extractBlocksFromSegmentedCritiqueText(segmentedCritiqueText, blockCount);
    const sourceExperiences = Array.isArray(raw.experiences) ? raw.experiences : [];

    const experiences = expectedBlocks.map((block, i) => {
        const blockText = block?.text || '';
        const expectedBullets = extractBulletsFromBlock(blockText);
        const srcExp = sourceExperiences[i] || {};
        const srcAnalysis = Array.isArray(srcExp.analysis) ? srcExp.analysis : [];
        const byKey = new Map();
        for (const a of srcAnalysis) {
            const key = bulletKey(a?.original_bullet || '');
            if (key && !byKey.has(key)) byKey.set(key, a);
        }

        const analysis = expectedBullets.map((bulletText) => {
            const key = bulletKey(bulletText);
            const hit = byKey.get(key);
            if (hit) {
                const existingSuggestions = Array.isArray(hit.suggestions) ? hit.suggestions.filter(Boolean) : [];
                const suggestions =
                    existingSuggestions.length >= 2
                        ? existingSuggestions.slice(0, 2)
                        : [...existingSuggestions, ...fallbackSuggestionsForBullet(bulletText)].slice(0, 2);
                return {
                    original_bullet: normalizeBulletText(hit.original_bullet || bulletText),
                    rating: clampRating(hit.rating, estimateBulletRatingFromText(bulletText)),
                    critique: String(hit.critique || '').trim() || fallbackCritiqueForRating(estimateBulletRatingFromText(bulletText)),
                    suggestions,
                };
            }
            const est = estimateBulletRatingFromText(bulletText);
            return {
                original_bullet: bulletText,
                rating: est,
                critique: fallbackCritiqueForRating(est),
                suggestions: fallbackSuggestionsForBullet(bulletText),
            };
        });

        return {
            role_at_company:
                block?.hintRole ||
                inferRoleAtCompanyFromBlock(blockText, srcExp.role_at_company || `Experience ${i + 1}`),
            analysis,
        };
    });

    return {
        ...raw,
        experiences,
    };
}

/** Stopwords for naive JD term frequency (Resume Matcher–style keyword hints without an LLM). */
const JD_STOPWORDS = new Set(
    `a an the and or but in on at to for of as is was are were be been being it this that these those with from by
will can may could should would must need if then than into about over after before between under again further
once here there when where why how all any both each few more most other some such no nor not only own same so
than too very just also back even still well our your their what which who whom while using via per
job role team work working experience years year ability abilities strong excellent good great skills skill including
include included requirements required preferred plus etc we you applicant candidates company`.split(/\s+/),
);

/**
 * Extract frequent substantive tokens from a job description for prompt hints.
 * Mirrors the idea of JD keyword lists in [Resume Matcher](https://github.com/srbhr/Resume-Matcher) without calling an LLM.
 */
export function extractJdKeywordHints(jdText, { max = 22 } = {}) {
    const t = String(jdText || '');
    // Lowercase words, acronyms (AWS, SQL), and simple CamelCase tokens
    const words =
        t.match(/\b[a-z][a-z0-9+#.-]{2,}\b|\b[A-Z]{2,}\b|\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g) || [];
    const freq = new Map();
    for (let w of words) {
        const k = w.toLowerCase();
        if (k.length < 3 || JD_STOPWORDS.has(k)) continue;
        freq.set(k, (freq.get(k) || 0) + 1);
    }
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, max)
        .map(([w]) => w);
}

/** One line for the optimize user message: frequent JD terms, honest-use only. */
export function formatJdKeywordHintsForPrompt(jdText, { max = 20 } = {}) {
    const hints = extractJdKeywordHints(jdText, { max });
    if (!hints.length) return '';
    return `Frequent job-description terms (use only where the SOURCE RESUME already supports them; do not invent skills): ${hints.join(', ')}.`;
}
