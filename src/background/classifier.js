const Classifier = {
    STRONG_REJECTION_PATTERNS: [
        /not (be )?moving forward/i,
        /decided not to move forward/i,
        /will not be moving forward/i,
        /unable to offer/i,
        /not selected/i,
        /decided to pursue other candidates/i,
        /pursuing other candidates/i,
        /offered? (the )?(position|role) to (another|other) candidate/i,
        /extended an offer to (another|other) candidate/i,
        /position has been filled/i,
        /filled (the )?(position|role)/i,
        /no longer considering/i,
        /not the right fit/i,
        /going (in )?a different direction/i,
        /more qualified candidates/i,
        /regret(s|ted)? to (inform|advise|let you know)/i,
        /whose qualifications better align/i,
        /better align(ed|s|ing)? with (our )?(requirements|needs|qualifications)/i,
        /unable to proceed (further )?with your application/i,
        /we (are )?unable to (move forward|proceed) with your application/i,
        /after careful (review|consideration)[^]{0,260}?(not (be )?moving forward|other candidate|regret|unable to offer|not selected|decided not|will not be moving|chosen (another|a different|other))/i,
        /unfortunately[^]{0,140}?(not selected|not moving forward|unable to|regret|other candidate|will not be|decided not|pursue other)/i
    ],

    hasStrongRejectionSignal(text) {
        if (!text) return false;
        return this.STRONG_REJECTION_PATTERNS.some((re) => re.test(text));
    },

    _isOfferToAnotherCandidate(text) {
        return (
            /offer.{0,40}(other|another) candidate/i.test(text) ||
            /(other|another) candidate.{0,40}offer/i.test(text)
        );
    },

    hasStrongInterviewSignal(text) {
        if (!text) return false;
        return /schedule (a |an )?(time|call|interview|phone screen)|availability for (a |an )?(call|interview)|invite you to (a |an )?interview|next steps? (is|are|would be) (to |)(a |an )?interview|phone screen (with|for|w\/)/i.test(
            text
        );
    },

    hasStrongOfferSignal(text) {
        if (!text) return false;
        if (this.hasStrongRejectionSignal(text) || this._isOfferToAnotherCandidate(text)) return false;
        if (/not (be )?moving forward|unable to offer/i.test(text)) return false;
        return /pleased to (extend|offer)|delighted to offer|happy to offer|would like to (extend|offer)|formal (job )?offer|offer letter( attached)?|compensation package|base salary|starting salary/i.test(
            text
        );
    },

    hasAppliedReceiptSignal(text) {
        if (!text) return false;
        if (this.hasStrongRejectionSignal(text)) return false;
        return /received your application|thank you for (your )?applying|application (has been )?received|we (have )?received your application/i.test(
            text
        );
    },

    /**
     * Rule-only status: high precision, returns null when evidence is weak (prefer LLM or skip).
     */
    predict(text) {
        if (!text || !String(text).trim()) return null;
        const t = String(text);
        if (this.hasStrongRejectionSignal(t) || this._isOfferToAnotherCandidate(t)) return "Rejected";
        if (this.hasStrongOfferSignal(t)) return "Offer";
        if (this.hasStrongInterviewSignal(t)) return "Interview";
        if (this.hasAppliedReceiptSignal(t)) return "Applied";
        return null;
    },

    /**
     * LLM path via Python classifier service (see python_classifier/service.py).
     * On failure, falls back to rule-based predict when evidence is clear; otherwise status null.
     */
    predictWithLocalLLM: async function (subject, body) {
        try {
            const { default: LocalLLM } = await import('./localLLM.js');
            const result = await LocalLLM.analyzeEmail(subject, body);
            const st = result.status;
            const statusOut =
                st === null
                    ? null
                    : ["Applied", "Assessment", "Interview", "Offer", "Rejected"].includes(st)
                      ? st
                      : "Applied";
            return {
                status: statusOut,
                role: result.role || null,
                company: result.company || null,
                reason: result.reason || null,
                confidence: typeof result.confidence === 'number' ? result.confidence : null,
                signals: Array.isArray(result.signals) ? result.signals : [],
                nextAction: result.nextAction || null,
                summary: result.summary || null
            };
        } catch (error) {
            console.warn("LocalLLM prediction failed, falling back to rule classifier:", error);
            const ruled = this.predict(subject + " " + body);
            return {
                status: ruled,
                role: ruled ? this.extractRole(subject, body) : null,
                company: null,
                reason: ruled ? null : "Local LLM unavailable and offline rules were inconclusive.",
                confidence: ruled ? 0.48 : null,
                signals: ruled ? ["Rule-based fallback (LLM error)"] : [],
                nextAction: null,
                summary: null
            };
        }
    },

    // Extract job role from text using pattern matching
    extractRole: function (subject, body) {
        const text = (subject + " " + body).toLowerCase();

        const compoundTitles = [
            /\b(senior|junior|lead|staff|principal|associate)\s+(software|frontend|backend|full[\s-]?stack|mobile|web|cloud|data|machine learning|ml|ai)\s+(engineer|developer|architect)\b/i,
            /\b(senior|junior|lead|staff|principal)\s+(product|project|program|engineering|technical)\s+(manager|director|lead)\b/i,
            /\b(senior|junior|lead)\s+(data|business|financial|marketing|sales)\s+(analyst|scientist)\b/i,
            /\b(senior|junior|lead)\s+(ux|ui|product|graphic|web)\s+designer\b/i,
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

        const standaloneTitles = [
            /\b(engineer|developer|designer|analyst|scientist|manager|director|architect|consultant|coordinator|specialist|intern)\b/i
        ];

        for (const pattern of standaloneTitles) {
            const match = text.match(pattern);
            if (match && match[0]) {
                const title = match[0].trim();
                if (subject.toLowerCase().includes(title)) {
                    return this.capitalizeTitle(title);
                }
            }
        }

        return null;
    },

    capitalizeTitle: function (title) {
        const lowercase = ['and', 'or', 'of', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for'];

        return title.split(/\s+/)
            .map((word, index) => {
                const lower = word.toLowerCase();
                if (index === 0 || !lowercase.includes(lower)) {
                    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                }
                return lower;
            })
            .join(' ');
    }
};

export default Classifier;
