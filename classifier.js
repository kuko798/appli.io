
const Classifier = {
    // Pre-calculated probabilities (Naive Bayes Model)
    // These represent P(word | class) * weight_factor
    // "Log probabilities" would be better but simple multiplication works for this scale if normalized

    // Structure: word: { Rejected: 0.X, Offer: 0.Y, Interview: 0.Z, Applied: 0.W }
    // We use "Likelihood Scores" here rather than strict probabilities for easier tweaking
    MODEL: {
        "unfortunately": { Rejected: 50, Offer: 0, Interview: 0, Applied: 1 },
        "reject": { Rejected: 100, Offer: 0, Interview: 0, Applied: 0 },
        "sorry": { Rejected: 10, Offer: 0, Interview: 0, Applied: 1 },
        "not_selected": { Rejected: 80, Offer: 0, Interview: 0, Applied: 0 },
        "moving_forward": { Rejected: 60, Offer: 5, Interview: 5, Applied: 5 }, // Context matters
        "unable_to_offer": { Rejected: 90, Offer: 0, Interview: 0, Applied: 0 },
        "regret": { Rejected: 40, Offer: 0, Interview: 0, Applied: 0 },
        "position_has_been_filled": { Rejected: 90, Offer: 0, Interview: 0, Applied: 0 },
        "other_candidates": { Rejected: 60, Offer: 0, Interview: 0, Applied: 5 },
        "pursue_other": { Rejected: 70, Offer: 0, Interview: 0, Applied: 0 },

        "schedule": { Rejected: 0, Offer: 2, Interview: 40, Applied: 5 },
        "availability": { Rejected: 0, Offer: 2, Interview: 30, Applied: 5 },
        "interview": { Rejected: 10, Offer: 5, Interview: 80, Applied: 20 }, // "Interview process"
        "chat": { Rejected: 0, Offer: 1, Interview: 20, Applied: 2 },
        "meet": { Rejected: 0, Offer: 1, Interview: 20, Applied: 2 },
        "screening": { Rejected: 5, Offer: 0, Interview: 50, Applied: 10 },
        "invite": { Rejected: 0, Offer: 5, Interview: 30, Applied: 5 },

        "offer": { Rejected: 5, Offer: 80, Interview: 5, Applied: 10 }, // "Offer you"
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
        "Applied": 2 // Slightly higher prior for Applied as it's the default
    },

    predict: function (text) {
        if (!text) return "Applied";

        // Normalize
        const tokens = this.tokenize(text);

        // Initialize scores with Priors
        let scores = { ...this.CLASS_PRIORS }; // Copy

        // Scoring Loop
        for (const token of tokens) {
            const wordProbs = this.MODEL[token];
            if (wordProbs) {
                scores["Rejected"] += wordProbs.Rejected;
                scores["Offer"] += wordProbs.Offer;
                scores["Interview"] += wordProbs.Interview;
                scores["Applied"] += wordProbs.Applied;
            }
        }

        // Special N-gram handling (Phrases)
        // "not be moving forward" -> Rejected
        if (/not (be )?moving forward|unable to offer|not selected|decided to pursue|position has been filled/i.test(text)) {
            scores["Rejected"] += 100;
        }
        // "would like to offer" -> Offer
        if (/pleased to offer|would like to offer/i.test(text)) {
            scores["Offer"] += 100;
        }
        // "schedule a time" -> Interview
        if (/schedule a time|availability for a call|invite you to interview/i.test(text)) {
            scores["Interview"] += 60;
        }


        // Find Max
        let maxLabel = "Applied";
        let maxScore = -1;

        console.log("Prediction Scores:", scores); // Debug

        for (const [label, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxLabel = label;
            }
        }

        return maxLabel;
    },

    tokenize: function (text) {
        // Simple tokenizer: lowercase, remove punctuation, split by space
        // Also captures simple bi-grams if needed, but here just unigrams
        return text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter(w => w.length > 2);
    }
};
