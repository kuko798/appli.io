
const Classifier = {
    // Pre-calculated probabilities (Naive Bayes Model)
    MODEL: {
        "unfortunately": { Rejected: 50, Offer: 0, Interview: 0, Applied: 1 },
        "reject": { Rejected: 100, Offer: 0, Interview: 0, Applied: 0 },
        "sorry": { Rejected: 10, Offer: 0, Interview: 0, Applied: 1 },
        "not_selected": { Rejected: 80, Offer: 0, Interview: 0, Applied: 0 },
        "moving_forward": { Rejected: 60, Offer: 5, Interview: 5, Applied: 5 },
        "unable_to_offer": { Rejected: 90, Offer: 0, Interview: 0, Applied: 0 },
        "regret": { Rejected: 40, Offer: 0, Interview: 0, Applied: 0 },
        "position_has_been_filled": { Rejected: 90, Offer: 0, Interview: 0, Applied: 0 },
        "other_candidates": { Rejected: 60, Offer: 0, Interview: 0, Applied: 5 },
        "pursue_other": { Rejected: 70, Offer: 0, Interview: 0, Applied: 0 },

        "schedule": { Rejected: 0, Offer: 2, Interview: 40, Applied: 5 },
        "availability": { Rejected: 0, Offer: 2, Interview: 30, Applied: 5 },
        "interview": { Rejected: 10, Offer: 5, Interview: 80, Applied: 20 },
        "chat": { Rejected: 0, Offer: 1, Interview: 20, Applied: 2 },
        "meet": { Rejected: 0, Offer: 1, Interview: 20, Applied: 2 },
        "screening": { Rejected: 5, Offer: 0, Interview: 50, Applied: 10 },
        "invite": { Rejected: 0, Offer: 5, Interview: 30, Applied: 5 },

        "offer": { Rejected: 5, Offer: 80, Interview: 5, Applied: 10 },
        "pleased": { Rejected: 0, Offer: 30, Interview: 5, Applied: 2 },
        "salary": { Rejected: 0, Offer: 40, Interview: 10, Applied: 5 },
        "compensation": { Rejected: 0, Offer: 40, Interview: 5, Applied: 5 },
        "contract": { Rejected: 0, Offer: 50, Interview: 5, Applied: 5 },
        "congratulations": { Rejected: 0, Offer: 60, Interview: 5, Applied: 1 },
        "hired": { Rejected: 0, Offer: 90, Interview: 0, Applied: 0 },

        "received": { Rejected: 1, Offer: 1, Interview: 1, Applied: 30 },
        "reviewing": { Rejected: 2, Offer: 0, Interview: 2, Applied: 40 },
        "submission": { Rejected: 0, Offer: 0, Interview: 0, Applied: 30 },
        "application": { Rejected: 5, Offer: 5, Interview: 5, Applied: 20 }
    },

    CLASS_PRIORS: {
        "Rejected": 1,
        "Offer": 1,
        "Interview": 1,
        "Applied": 2
    },

    predict: function (text) {
        if (!text) return "Applied";
        const tokens = this.tokenize(text);
        let scores = { ...this.CLASS_PRIORS };

        for (const token of tokens) {
            const wordProbs = this.MODEL[token];
            if (wordProbs) {
                scores["Rejected"] += wordProbs.Rejected;
                scores["Offer"] += wordProbs.Offer;
                scores["Interview"] += wordProbs.Interview;
                scores["Applied"] += wordProbs.Applied;
            }
        }

        if (/not (be )?moving forward|unable to offer|not selected|decided to pursue|position has been filled/i.test(text)) {
            scores["Rejected"] += 100;
        }
        if (/pleased to offer|would like to offer/i.test(text)) {
            scores["Offer"] += 100;
        }
        if (/schedule a time|availability for a call|invite you to interview/i.test(text)) {
            scores["Interview"] += 60;
        }

        let maxLabel = "Applied";
        let maxScore = -1;

        for (const [label, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxLabel = label;
            }
        }
        return maxLabel;
    },

    // Extract job role from text using pattern matching
    extractRole: function (subject, body) {
        const text = (subject + " " + body).toLowerCase();

        // First, try to find compound job titles (most specific)
        const compoundTitles = [
            // Tech roles
            /\b(senior|junior|lead|staff|principal|associate)\s+(software|frontend|backend|full[\s-]?stack|mobile|web|cloud|data|machine learning|ml|ai)\s+(engineer|developer|architect)\b/i,
            /\b(senior|junior|lead|staff|principal)\s+(product|project|program|engineering|technical)\s+(manager|director|lead)\b/i,
            /\b(senior|junior|lead)\s+(data|business|financial|marketing|sales)\s+(analyst|scientist)\b/i,
            /\b(senior|junior|lead)\s+(ux|ui|product|graphic|web)\s+designer\b/i,

            // Without seniority prefix
            /\b(software|frontend|backend|full[\s-]?stack|mobile|web|cloud|data|machine learning|ml|ai)\s+(engineer|developer|architect)\b/i,
            /\b(product|project|program|engineering|technical)\s+(manager|director|lead)\b/i,
            /\b(data|business|financial|marketing|sales)\s+(analyst|scientist)\b/i,
            /\b(ux|ui|product|graphic|web)\s+designer\b/i,
            /\b(devops|qa|quality assurance)\s+engineer\b/i,
        ];

        for (const pattern of compoundTitles) {
            const match = text.match(pattern);
            if (match && match[0]) {
                return this.capitalizeTitle(match[0].trim());
            }
        }

        // Then try single-word titles with optional seniority
        const singleTitles = [
            /\b(senior|junior|lead|staff|principal)\s+(engineer|developer|designer|analyst|manager|director|architect|consultant|coordinator|specialist)\b/i,
            /\b(software engineer|data scientist|product manager|project manager|program manager)\b/i,
        ];

        for (const pattern of singleTitles) {
            const match = text.match(pattern);
            if (match && match[0]) {
                return this.capitalizeTitle(match[0].trim());
            }
        }

        // Finally, try standalone common titles (least specific)
        const standaloneTitles = [
            /\b(engineer|developer|designer|analyst|scientist|manager|director|architect|consultant|coordinator|specialist|intern)\b/i
        ];

        for (const pattern of standaloneTitles) {
            const match = text.match(pattern);
            if (match && match[0]) {
                const title = match[0].trim();
                // Only return if it's in the subject (more likely to be the actual role)
                if (subject.toLowerCase().includes(title)) {
                    return this.capitalizeTitle(title);
                }
            }
        }

        return null; // No role found
    },

    capitalizeTitle: function (title) {
        // List of words that should stay lowercase (unless at start)
        const lowercase = ['and', 'or', 'of', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for'];

        return title.split(/\s+/)
            .map((word, index) => {
                const lower = word.toLowerCase();
                // Always capitalize first word, or if not in lowercase list
                if (index === 0 || !lowercase.includes(lower)) {
                    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                }
                return lower;
            })
            .join(' ');
    },

    tokenize: function (text) {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter(w => w.length > 2);
    }
};

export default Classifier;
