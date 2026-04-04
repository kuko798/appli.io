import { describe, expect, it } from 'vitest';
import {
    RESUME_CRITIQUE_CHAR_LIMIT,
    RESUME_OPTIMIZE_CHAR_LIMIT,
    SUMMARY_CARD_LABELS,
    buildReportDataFromCritiqueJson,
    cleanOptimizedOutput,
    collapseExcessBlankLines,
    enforceCritiqueBulletCoverage,
    extractJdKeywordHints,
    formatJdKeywordHintsForPrompt,
    formatSegmentedBlocksForCritiquePrompt,
    looksLikeCompanyDateLine,
    looksLikeOrgLocationLine,
    splitExperienceIntoJobBlocks,
    llmErrorMessage,
    normalizeKeys,
    scoreColor,
    sliceForCritiquePrompt,
    sliceForOptimizePrompt,
    stripCodeFences,
    stripConsumerBrandSkillNoise,
    wordCount,
} from './resumeOptimizerUtils.js';

/** Short “already extracted” resume text (no PDF/DOCX). */
export const SAMPLE_EXTRACTED_RESUME = `Alex Chen
alex.chen@email.com | (555) 010-2030

EXPERIENCE

Riverdale Clinic, Portland, OR
Medical Receptionist
June 2022 – Present
• Checked in 40+ patients per shift and updated EHR records accurately.
• Coordinated scheduling with three providers, reducing wait-time complaints.

Northside Tutoring, Portland, OR
Tutor (Part-time)
Jan 2021 – May 2022
• Taught algebra and study skills to groups of 6–10 high school students.

EDUCATION
Portland Community College — A.A. Health Studies (2021)

SKILLS
Scheduling software, HIPAA awareness, Spanish (conversational)
`;

describe('sliceForCritiquePrompt / sliceForOptimizePrompt', () => {
    it('detects ALL CAPS professional experience headers', () => {
        const raw = `NAME\n\nPROFESSIONAL EXPERIENCE\n\nAcme Co\nEngineer\n• Built API\n`;
        const s = sliceForCritiquePrompt(raw);
        expect(s).toContain('Acme Co');
        expect(s).toContain('Built API');
    });

    it('keeps experience blocks and omits education/skills for critique slice', () => {
        const s = sliceForCritiquePrompt(SAMPLE_EXTRACTED_RESUME);
        expect(s).toContain('Riverdale Clinic');
        expect(s).not.toContain('EDUCATION');
        expect(s).not.toContain('SKILLS');
        expect(s.length).toBeLessThanOrEqual(RESUME_CRITIQUE_CHAR_LIMIT);
    });

    it('truncates long extracted resume to critique limit', () => {
        const long = 'x'.repeat(RESUME_CRITIQUE_CHAR_LIMIT + 500);
        const s = sliceForCritiquePrompt(long);
        expect(s.length).toBe(RESUME_CRITIQUE_CHAR_LIMIT);
    });

    it('truncates to optimize limit (larger cap)', () => {
        const long = 'x'.repeat(RESUME_OPTIMIZE_CHAR_LIMIT + 500);
        const s = sliceForOptimizePrompt(long);
        expect(s.length).toBe(RESUME_OPTIMIZE_CHAR_LIMIT);
    });
});

describe('wordCount', () => {
    it('counts words for sample resume', () => {
        const n = wordCount(SAMPLE_EXTRACTED_RESUME);
        expect(n).toBeGreaterThan(60);
        expect(n).toBeLessThan(200);
    });
});

describe('scoreColor', () => {
    it('maps rating bands to theme colors', () => {
        expect(scoreColor(9)).toBe('#10b981');
        expect(scoreColor(7)).toBe('#f59e0b');
        expect(scoreColor(3)).toBe('#f87171');
    });
});

describe('SUMMARY_CARD_LABELS', () => {
    it('covers legacy tech_arity key for UI fallback', () => {
        expect(SUMMARY_CARD_LABELS.tech_arity).toBe('Impact & specificity');
    });
});

describe('normalizeKeys', () => {
    it('lowercases nested keys from fake LLM JSON', () => {
        const raw = {
            Summary: { Structural_Integrity: { Rating: 8, Advice: 'OK' } },
        };
        const n = normalizeKeys(raw);
        expect(n.summary.structural_integrity.rating).toBe(8);
        expect(n.summary.structural_integrity.advice).toBe('OK');
    });
});

describe('buildReportDataFromCritiqueJson', () => {
    it('fills summary from bullet ratings when model echoed zero placeholders', () => {
        const report = buildReportDataFromCritiqueJson({
            summary: {
                structural_integrity: { rating: 0, advice: '' },
                signal_strength: { rating: 0, advice: '' },
                impact_specificity: { rating: 0, advice: '' },
            },
            experiences: [
                {
                    role_at_company: 'Engineer, Acme',
                    analysis: [
                        { original_bullet: 'Shipped feature', rating: 8, critique: 'ok', suggestions: ['a', 'b'] },
                        { original_bullet: 'Fixed bugs', rating: 6, critique: 'ok', suggestions: ['a', 'b'] },
                    ],
                },
            ],
            upgrade_path: [],
        });
        expect(report.summary.structural_integrity.rating).toBe(7);
        expect(report.summary.structural_integrity.advice).toContain('bullet');
    });

    const fakeLlmResponse = {
        summary: {
            structural_integrity: { rating: 7, advice: 'Clear sections' },
            signal_strength: { rating: 6, advice: 'Add metrics' },
            impact_specificity: { rating: 5, advice: 'More scope' },
        },
        experiences: [
            {
                role_at_company: 'Receptionist, Riverdale Clinic',
                analysis: [
                    {
                        original_bullet: 'Checked in patients',
                        rating: 5,
                        critique: 'Too vague',
                        suggestions: ['Quantify daily volume', 'Name EHR'],
                    },
                ],
            },
        ],
        upgrade_path: ['Lead with outcomes', 'Tighten skills'],
    };

    it('maps fake critique JSON to reportData shape', () => {
        const report = buildReportDataFromCritiqueJson(fakeLlmResponse);
        expect(report.summary.structural_integrity.rating).toBe(7);
        expect(report.summary.impact_specificity.advice).toBe('More scope');
        expect(report.experiences).toHaveLength(1);
        expect(report.experiences[0].role_at_company).toBe('Receptionist, Riverdale Clinic');
        expect(report.experiences[0].analysis[0].original_bullet).toBe('Checked in patients');
        expect(report.upgrade_path).toEqual(['Lead with outcomes', 'Tighten skills']);
    });

    it('falls back tech_arity to impact_specificity slot', () => {
        const report = buildReportDataFromCritiqueJson({
            summary: {
                structural_integrity: { rating: 1, advice: '' },
                signal_strength: { rating: 1, advice: '' },
                tech_arity: { rating: 9, advice: 'Strong' },
            },
            experiences: [],
            upgrade_path: [],
        });
        expect(report.summary.impact_specificity.rating).toBe(9);
        expect(report.summary.impact_specificity.advice).toBe('Strong');
    });

    it('drops bullets without original_bullet text', () => {
        const report = buildReportDataFromCritiqueJson({
            summary: {
                structural_integrity: { rating: 1, advice: '' },
                signal_strength: { rating: 1, advice: '' },
                impact_specificity: { rating: 1, advice: '' },
            },
            experiences: [
                {
                    role_at_company: 'X',
                    analysis: [{ original_bullet: '', rating: 5, critique: 'x', suggestions: [] }],
                },
            ],
            upgrade_path: [],
        });
        expect(report.experiences).toHaveLength(0);
    });
});

describe('enforceCritiqueBulletCoverage', () => {
    it('fills missing bullet analyses so each source bullet has feedback', () => {
        const segmented = `>>> JOB_BLOCK 1 OF 1 <<<\nAcme Corp\nEngineer\n• Built API endpoints\n• Reduced incidents by 20%`;
        const modelJson = {
            experiences: [
                {
                    role_at_company: 'Engineer, Acme Corp',
                    analysis: [
                        {
                            original_bullet: 'Built API endpoints',
                            rating: 7,
                            critique: 'Good start',
                            suggestions: ['Built and documented API endpoints for internal services'],
                        },
                    ],
                },
            ],
        };

        const covered = enforceCritiqueBulletCoverage(modelJson, segmented, 1);
        expect(covered.experiences).toHaveLength(1);
        expect(covered.experiences[0].analysis).toHaveLength(2);
        expect(covered.experiences[0].analysis[0].suggestions.length).toBe(2);
        expect(covered.experiences[0].analysis[1].original_bullet).toContain('Reduced incidents by 20%');
    });

    it('pads missing experience blocks when model returns fewer blocks than expected', () => {
        const segmented = `>>> JOB_BLOCK 1 OF 2 <<<\nA\nRole\n• Bullet A\n\n---\n\n>>> JOB_BLOCK 2 OF 2 <<<\nB\nRole\n• Bullet B`;
        const modelJson = {
            experiences: [
                {
                    role_at_company: 'Role, A',
                    analysis: [{ original_bullet: 'Bullet A', rating: 6, critique: 'ok', suggestions: ['a', 'b'] }],
                },
            ],
        };

        const covered = enforceCritiqueBulletCoverage(modelJson, segmented, 2);
        expect(covered.experiences).toHaveLength(2);
        expect(covered.experiences[1].analysis).toHaveLength(1);
        expect(covered.experiences[1].analysis[0].original_bullet).toBe('Bullet B');
    });

    it('prefers JOB_BLOCK hint role_at_company over mismatched model role labels', () => {
        const segmented = `>>> JOB_BLOCK 1 OF 1 [HINT: role_at_company = "Software Engineer Intern, Enterprise Mobility"] — use ONLY the bullets inside this block <<<\nEnterprise Mobility May 2025 – July 2025\nSoftware Engineer Intern Saint Louis, MO\n• Developed 8 integration tests for Gameplan`;
        const modelJson = {
            experiences: [
                {
                    role_at_company: 'Co-Founder & Software Engineer, DevHeads',
                    analysis: [
                        {
                            original_bullet: 'Developed 8 integration tests for Gameplan',
                            rating: 7,
                            critique: 'ok',
                            suggestions: ['a', 'b'],
                        },
                    ],
                },
            ],
        };
        const covered = enforceCritiqueBulletCoverage(modelJson, segmented, 1);
        expect(covered.experiences[0].role_at_company).toBe('Software Engineer Intern, Enterprise Mobility');
    });

    it('reconstructs PDF-wrapped bullet lines instead of cutting mid-sentence', () => {
        const segmented = `>>> JOB_BLOCK 1 OF 1 [HINT: role_at_company = "Co-Founder & Software Engineer, DevHeads"] <<<\nDevHeads June 2023 - Present\nCo-Founder & Software Engineer Saint Louis, MO\n• Spearheaded the development of Connect, a high school/alum network platform, designing an SQL database to efficiently\nmanage 300+ users and improve alumni engagement by 15%`;
        const covered = enforceCritiqueBulletCoverage({ experiences: [] }, segmented, 1);
        const text = covered.experiences[0].analysis[0].original_bullet;
        expect(text).toContain('designing an SQL database to efficiently manage 300+ users');
        expect(text).toContain('15%');
    });
});

describe('cleanOptimizedOutput (fake LLM plain-text resume)', () => {
    it('strips markdown fences', () => {
        const raw = '```plaintext\nJane Doe\n• Built things\n```';
        expect(cleanOptimizedOutput(raw)).toBe('Jane Doe\n• Built things');
    });

    it('removes junk consumer-brand-only skill line but keeps Tools', () => {
        const raw = `Skills\nTools: Git, React\nApple, Google, TikTok, OpenAI, Meta`;
        const out = cleanOptimizedOutput(raw);
        expect(out).toContain('Tools: Git, React');
        expect(out).not.toContain('TikTok');
    });

    it('collapses runaway blank lines', () => {
        const raw = 'A\n\n\n\n\nB';
        expect(collapseExcessBlankLines(raw)).toBe('A\n\n\nB');
    });
});

describe('stripCodeFences', () => {
    it('handles plain text', () => {
        expect(stripCodeFences('  hello  ')).toBe('hello');
    });
});

describe('stripConsumerBrandSkillNoise', () => {
    it('keeps bullet lines even if they mention a brand', () => {
        const line = '• Integrated Salesforce for the sales team';
        expect(stripConsumerBrandSkillNoise(line)).toContain('Salesforce');
    });
});

describe('llmErrorMessage', () => {
    it('parses FastAPI string detail', () => {
        const err = { message: 'Bad', responseText: JSON.stringify({ detail: 'Out of memory' }) };
        expect(llmErrorMessage(err)).toBe('Out of memory');
    });
});

describe('splitExperienceIntoJobBlocks / JOB_BLOCK markers', () => {
    const multiJob = `PROFESSIONAL EXPERIENCE

IBM, Madison, WI
Incoming AI Customer Success Manager
May 2026 – Present
• Will start work in May 2026

Enterprise Mobility, Saint Louis, MO
Software Engineer Intern
May 2025 – July 2025
• Developed 8 integration tests for Gameplan

Rockwell Automation, Milwaukee, WI
Software Engineer Intern
May 2024 – August 2024
• Implemented automated API testing framework
`;

    it('detects org lines ending with state abbreviation', () => {
        expect(looksLikeOrgLocationLine('IBM, Madison, WI')).toBe(true);
        expect(looksLikeOrgLocationLine('Enterprise Mobility, Saint Louis, MO')).toBe(true);
        expect(looksLikeOrgLocationLine('• Built API')).toBe(false);
        expect(looksLikeOrgLocationLine('May 2025 – July 2025')).toBe(false);
    });

    it('splits into one block per employer', () => {
        const blocks = splitExperienceIntoJobBlocks(multiJob);
        expect(blocks.length).toBe(3);
        expect(blocks[0]).toContain('IBM');
        expect(blocks[0]).toContain('May 2026');
        expect(blocks[1]).toContain('Enterprise Mobility');
        expect(blocks[1]).toContain('Gameplan');
        expect(blocks[2]).toContain('Rockwell');
        expect(blocks[2]).not.toContain('Enterprise Mobility');
    });

    it('formatSegmentedBlocksForCritiquePrompt adds markers and count', () => {
        const { text, blockCount } = formatSegmentedBlocksForCritiquePrompt(multiJob);
        expect(blockCount).toBe(3);
        expect(text).toContain('JOB_BLOCK 1 OF 3');
        expect(text).toContain('JOB_BLOCK 2 OF 3');
        expect(text).toContain('JOB_BLOCK 3 OF 3');
    });

    const pdfStyleResume = `Professional Experience

IBM May 2026 – Present

Incoming AI Customer Success Manager Technical Specialist Madison, WI
• Will start work in May 2026

Enterprise Mobility May 2025 – July 2025

Software Engineer Intern Saint Louis, MO
• Developed 8 integration tests for Gameplan

Rockwell Automation May 2024 – August 2024
Software Engineer Intern Milwaukee, WI
• Automated unit test coverage

DevHeads June 2023 – Present

Co-Founder & Software Engineer Saint Louis, MO
• Designed and developed websites for 5 small businesses

Leadership

Black Men Collective May 2024 – Present

Co-President Madison, WI
• Spearheaded the planning

Omega Psi Phi Fraternity, Incorporated November 2024 – Present

Vice President, Epsilon Theta Chapter Madison, WI
• Managed risk assessment

ColorStack at UW Madison December 2023 – Present

Treasurer Madison, WI
• Initiated and managed a new fund
`;

    it('looksLikeCompanyDateLine detects PDF-style company + date lines', () => {
        expect(looksLikeCompanyDateLine('IBM May 2026 – Present')).toBe(true);
        expect(looksLikeCompanyDateLine('Enterprise Mobility May 2025 – July 2025')).toBe(true);
        expect(looksLikeCompanyDateLine('Omega Psi Phi Fraternity, Incorporated November 2024 – Present')).toBe(true);
        expect(looksLikeCompanyDateLine('• Bullet May 2025 – Present')).toBe(false);
        expect(looksLikeCompanyDateLine('May 2026 – Present')).toBe(false);
    });

    it('splits PDF-mangled layout into separate job blocks (experience + leadership)', () => {
        const blocks = splitExperienceIntoJobBlocks(pdfStyleResume);
        expect(blocks.length).toBe(7);
        expect(blocks[0]).toContain('IBM');
        expect(blocks[0]).toContain('Will start work');
        expect(blocks[1]).toContain('Enterprise Mobility');
        expect(blocks[1]).toContain('Gameplan');
        expect(blocks[3]).toContain('DevHeads');
        expect(blocks[3]).toContain('websites for 5 small');
        expect(blocks[4]).toContain('Black Men Collective');
        expect(blocks[5]).toContain('Omega Psi Phi');
        expect(blocks[6]).toContain('ColorStack');
    });
});

describe('extractJdKeywordHints (Resume Matcher–style JD hints, no LLM)', () => {
    const sampleJd = `
        We seek a Senior Backend Engineer with Python, FastAPI, PostgreSQL, and AWS.
        Experience with microservices and Docker required. Python and AWS are must-haves.
        Team player with strong communication skills.
    `;

    it('surfaces repeated technical terms', () => {
        const hints = extractJdKeywordHints(sampleJd, { max: 12 });
        expect(hints).toContain('python');
        expect(hints).toContain('aws');
        expect(hints).toContain('microservices');
        expect(hints).toContain('docker');
    });

    it('formatJdKeywordHintsForPrompt returns empty for blank JD', () => {
        expect(formatJdKeywordHintsForPrompt('   ')).toBe('');
    });

    it('formatJdKeywordHintsForPrompt is a single honest-use line', () => {
        const line = formatJdKeywordHintsForPrompt(sampleJd, { max: 8 });
        expect(line).toContain('Frequent job-description terms');
        expect(line).toContain('SOURCE RESUME');
    });
});

describe('critique prompt slice uses sample resume', () => {
    it('embedded resume body fits model prompt budget', () => {
        const embedded = sliceForCritiquePrompt(SAMPLE_EXTRACTED_RESUME);
        expect(embedded.length).toBeLessThanOrEqual(RESUME_CRITIQUE_CHAR_LIMIT);
        expect(embedded).toContain('Riverdale Clinic');
        expect(embedded).toContain('EHR');
    });
});

/**
 * We do not call a real LLM in unit tests. These cases use:
 * - a deliberately weak extracted resume (input you would send in the prompt), and
 * - mock JSON / plain text shaped like what the model would return after “improve bullets.”
 * They guard that our parsers surface stronger suggestions and cleaned full rewrites — not model quality itself.
 */
describe('weak resume vs improved bullets (mock LLM only)', () => {
    const WEAK_EXTRACTED_RESUME = `Pat Jones
pat@email.com

EXPERIENCE
Acme Logistics, Boise, ID
Warehouse Associate
2023 – Present
• Did stuff in the warehouse.
• Helped out when needed.
• Worked with the team on things.

SKILLS
Hard worker, Microsoft Word
`;

    const MOCK_CRITIQUE_JSON = {
        summary: {
            structural_integrity: { rating: 4, advice: 'Sections exist but bullets lack impact.' },
            signal_strength: { rating: 3, advice: 'No scale, tools, or outcomes.' },
            impact_specificity: { rating: 3, advice: 'Replace vague duties with scope + results.' },
        },
        experiences: [
            {
                role_at_company: 'Warehouse Associate, Acme Logistics',
                analysis: [
                    {
                        original_bullet: 'Did stuff in the warehouse.',
                        rating: 2,
                        critique: 'Says nothing specific.',
                        suggestions: [
                            'Picked and packed 200+ SKUs per shift with 99.2% accuracy (RF scanner).',
                            'Operated reach truck and maintained OSHA-compliant staging zones.',
                        ],
                    },
                    {
                        original_bullet: 'Helped out when needed.',
                        rating: 3,
                        critique: 'Generic collaboration line.',
                        suggestions: [
                            'Covered receiving dock during peak season, cutting truck wait time by ~25%.',
                        ],
                    },
                ],
            },
        ],
        upgrade_path: ['Quantify volume or time saved on every bullet', 'Name tools (WMS, forklift class)'],
    };

    const MOCK_FULL_REWRITE_PLAIN_TEXT = `Pat Jones
pat@email.com

EXPERIENCE

Acme Logistics, Boise, ID
Warehouse Associate
2023 – Present
• Picked and packed 200+ SKUs per shift with 99.2% accuracy using an RF scanner and WMS.
• Covered the receiving dock during peak season, reducing average truck wait time by approximately 25%.
• Collaborated with a 6-person crew on cycle counts and slotting updates to support same-day shipping goals.

SKILLS
RF scanners, WMS, reach-truck operation, OSHA awareness, Microsoft Word
`;

    it('includes terrible bullets in the text slice sent to the diagnose prompt', () => {
        const embedded = sliceForCritiquePrompt(WEAK_EXTRACTED_RESUME);
        expect(embedded).toContain('Did stuff in the warehouse');
        expect(embedded).toContain('Helped out when needed');
    });

    it('maps mock diagnose JSON so suggestions are concrete upgrades over weak originals', () => {
        const report = buildReportDataFromCritiqueJson(MOCK_CRITIQUE_JSON);
        expect(report.experiences).toHaveLength(1);
        const [first, second] = report.experiences[0].analysis;
        expect(first.original_bullet).toBe('Did stuff in the warehouse.');
        expect(first.suggestions[0]).toMatch(/200\+|99\.2%/);
        expect(second.original_bullet).toBe('Helped out when needed.');
        expect(second.suggestions[0]).toMatch(/25%|receiving/i);
        expect(report.upgrade_path[0]).toContain('Quantify');
    });

    it('accepts mock full-resume rewrite: improved bullets replace vague phrasing after cleanup', () => {
        const wrapped = `\`\`\`plaintext\n${MOCK_FULL_REWRITE_PLAIN_TEXT}\n\`\`\``;
        const out = cleanOptimizedOutput(wrapped);
        expect(out).toContain('• Picked and packed 200+');
        expect(out).toContain('99.2%');
        expect(out).not.toContain('Did stuff in the warehouse');
        expect(out).not.toContain('Helped out when needed');
    });
});
