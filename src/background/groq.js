const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const Groq = {
    analyzeEmail: async function (apiKey, subject, body) {
        if (!apiKey) throw new Error("Groq API Key is missing");


        const prompt = `
You are an intelligent job application email classifier.

Your FIRST task is to determine whether this email is related to a REAL job application
(application confirmation, interview, rejection, or offer).

If the email is NOT related to a job application (newsletters, job alerts, promotions,
marketing, generic recruiting ads, events, sales, or spam), then respond with:
{
  "status": null,
  "role": null,
  "company": null
}

If the email IS related to a job application, then infer the following information
as accurately as possible, even if it is not explicitly stated.

Rules:
- Make reasonable inferences based on context, sender, and wording.
- Do NOT guess wildly or invent companies or roles.
- If a value truly cannot be inferred, use null.
- Do NOT include explanations or extra text.

Determine:
1. status — MUST be one of:
   "Applied"     → confirmation of application submission
   "Interview"   → invitation to interview, call, or next steps
   "Offer"       → job offer or offer discussion
   "Rejected"    → rejection or not moving forward

2. role — the job title (e.g., "Software Engineer", "Data Analyst")
3. company — the company name (e.g., "Google", "Amazon")

Respond ONLY with a valid JSON object in EXACTLY this format:
{
  "status": "Applied" | "Interview" | "Offer" | "Rejected" | null,
  "role": string | null,
  "company": string | null
}

Email Subject:
${subject}

Email Body:
${body.substring(0, 5000)}
`;


        try {
            console.log("🚀 Sending to Groq (LLaMA 3)...");
            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Groq API request failed");
            }

            const data = await response.json();
            const text = data.choices[0].message.content;
            const parsed = JSON.parse(text);

            console.log("📦 Groq Parsed Result:", parsed);
            return parsed;
        } catch (error) {
            console.error("Groq Analysis Error:", error);
            throw error;
        }
    },

    async validateKey(apiKey) {
        try {
            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: "ping" }],
                    max_tokens: 1
                }),
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }
};

export default Groq;
