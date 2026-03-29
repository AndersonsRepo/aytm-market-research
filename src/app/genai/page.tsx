import Link from "next/link";

export const metadata = {
  title: "GenAI Documentation — AYTM Research Pipeline",
  description:
    "Tools, prompts, AI-generated components, and human modifications used in the AYTM synthetic research pipeline",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function StageCard({
  stage,
  title,
  badge,
  badgeColor,
  description,
  details,
}: {
  stage: number;
  title: string;
  badge: string;
  badgeColor: "blue" | "emerald" | "gray";
  description: string;
  details: string[];
}) {
  const colorMap = {
    blue: "bg-blue-900/50 text-blue-300 border-blue-800",
    emerald: "bg-emerald-900/50 text-emerald-300 border-emerald-800",
    gray: "bg-gray-700/50 text-gray-300 border-gray-600",
  };
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
            {stage}
          </span>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full border ${colorMap[badgeColor]}`}
        >
          {badge}
        </span>
      </div>
      <p className="text-sm text-gray-300 mb-3">{description}</p>
      <ul className="space-y-1.5">
        {details.map((d, i) => (
          <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">→</span>
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GenAIDocumentationPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 inline-block"
          >
            ← Back to Pipeline
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            GenAI Documentation
          </h1>
          <p className="text-gray-400 text-lg">
            Tools, prompts, AI-generated components, and human modifications
            used in the AYTM synthetic research pipeline.
          </p>
        </div>

        {/* Section 1: Tools & Models */}
        <Section title="Tools & Models Used">
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 text-gray-400 font-medium">
                    Tool / Model
                  </th>
                  <th className="text-left py-2 text-gray-400 font-medium">
                    Provider
                  </th>
                  <th className="text-left py-2 text-gray-400 font-medium">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["OpenRouter API", "OpenRouter", "Unified LLM gateway"],
                  [
                    "GPT-4.1-mini",
                    "OpenAI",
                    "Discovery, interviews, survey responses, synthesis",
                  ],
                  [
                    "Gemini-2.5-Flash",
                    "Google",
                    "Discovery, interviews, survey responses",
                  ],
                  [
                    "Claude-Sonnet-4.6",
                    "Anthropic",
                    "Discovery, interviews, survey responses",
                  ],
                  [
                    "Next.js 14 + TypeScript",
                    "Vercel",
                    "Frontend & API routes",
                  ],
                  [
                    "Supabase PostgreSQL",
                    "Supabase",
                    "Data layer + realtime",
                  ],
                  ["Recharts", "Open-source", "Data visualizations"],
                  [
                    "VADER Sentiment",
                    "NLTK-equivalent",
                    "Sentiment analysis (no API)",
                  ],
                  ["Vercel", "Vercel", "Production deployment"],
                ].map(([tool, provider, role], i) => (
                  <tr key={i} className="border-b border-gray-800">
                    <td className="py-2.5 pr-4 text-gray-200 font-medium">
                      {tool}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400">{provider}</td>
                    <td className="py-2.5 px-4 text-gray-400">{role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500">
            All three LLMs are accessed through OpenRouter, enabling{" "}
            <strong className="text-gray-300">STAMP</strong> (Structured
            Taxonomy AI Measurement Protocol) — applied at two levels:
            generation-level (model mean correlation for survey responses)
            and classification-level (Krippendorff&apos;s α for emotion
            classification, theme extraction, and market interpretation).
          </p>
        </Section>

        {/* Section 2: AI-Generated Components */}
        <Section title="AI-Generated Components">
          <StageCard
            stage={1}
            title="Discovery"
            badge="3 models × 10 questions"
            badgeColor="blue"
            description="Three models each answer 10 strategic market research questions about the Neo Smart Living product category."
            details={[
              "Independent responses from GPT-4.1-mini, Gemini-2.5-Flash, and Claude-Sonnet-4.6",
              "AI-synthesized research brief consolidating themes, opportunities, and risks",
            ]}
          />
          <StageCard
            stage={2}
            title="Depth Interviews"
            badge="30 interviews + STAMP"
            badgeColor="blue"
            description="30 simulated depth interviews (10 personas × 3 models) with 8 core questions plus adaptive follow-ups."
            details={[
              "STAMP emotion classification: all 3 models independently classify each interview using codebook prompts with boundary cases, measured via Krippendorff's α",
              "STAMP theme extraction: all 3 models independently extract themes, measured via Jaccard similarity",
              "Majority-vote consensus determines final emotion per interview",
            ]}
          />
          <StageCard
            stage={3}
            title="Survey Design"
            badge="3 independent instruments"
            badgeColor="blue"
            description="Three models independently design survey instruments grounded in Stage 2 themes."
            details={[
              "Each model produces a complete survey with Likert scales, categorical, and open-ended questions",
              "AI-powered cross-model coverage analysis identifies consensus and gaps",
              "Theme-to-question traceability enforced by prompt design",
            ]}
          />
          <StageCard
            stage={4}
            title="Survey Responses"
            badge="90 respondents"
            badgeColor="blue"
            description="90 synthetic respondents (5 segments × 6 respondents × 3 models) complete the designed survey."
            details={[
              "Third-person prediction framing to reduce sycophancy bias",
              "13 variation seeds (5 positive + 8 skeptical) for realistic distribution",
              "Calibration anchors and anti-central-tendency instructions",
            ]}
          />
          <StageCard
            stage={5}
            title="Statistical Analysis"
            badge="Computation + STAMP"
            badgeColor="blue"
            description="Deterministic statistical tests plus STAMP interpretation agreement — 3 models independently classify the aggregate survey data."
            details={[
              "Mann-Whitney U, Kruskal-Wallis H, bootstrap CIs (deterministic)",
              "Krippendorff's α for response-level inter-LLM reliability",
              "STAMP interpretation agreement: 3 models classify the same dataset (dominant barrier, primary use case, purchase intent, best segment, market readiness) — true classification task where α applies",
            ]}
          />
          <StageCard
            stage={6}
            title="Quality Validation"
            badge="No AI"
            badgeColor="gray"
            description="Pure computation — automated quality checks and bias detection run without any AI."
            details={[
              "Acquiescence bias detection and correction",
              "Inter-model reliability scoring per question",
              "Benchmark comparison against real aytm N=600 survey data",
            ]}
          />
        </Section>

        {/* Section 3: Prompt Strategies */}
        <Section title="Prompt Strategies">
          <div className="space-y-4">
            {[
              {
                stage: "Stage 1 — Discovery",
                description:
                  "Market research consultant role with 10 strategic questions covering market sizing, competitive landscape, consumer pain points, and adoption barriers.",
                temp: null,
              },
              {
                stage: "Stage 2 — Interviews",
                description:
                  "Persona-grounded interview simulation with detailed demographic and psychographic profiles. 8 core questions with adaptive follow-ups based on prior answers.",
                temp: "0.8",
              },
              {
                stage: "Stage 3 — Survey Design",
                description:
                  "Survey methodologist role with explicit theme-to-question traceability — every survey question must map back to a Stage 2 theme.",
                temp: "0.4",
              },
              {
                stage: "Stage 4 — Survey Responses",
                description:
                  'Third-person prediction framing ("predict how this consumer would respond") instead of role-play. Sycophancy reduction via calibration anchors, explicit rejection permission, and 13 variation seeds (including 8 skeptical personas: financially constrained, status-quo-satisfied, risk-averse).',
                temp: "0.7",
              },
              {
                stage: "Synthesis",
                description:
                  "Multi-model consensus extraction identifies agreement and divergence across all three LLMs, weighting high-agreement findings more heavily.",
                temp: null,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-gray-900/60 border border-gray-800 rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-blue-400">
                    {item.stage}
                  </h3>
                  {item.temp && (
                    <code className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                      temp={item.temp}
                    </code>
                  )}
                </div>
                <p className="text-sm text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Section 4: Human Modifications */}
        <Section title="Human Modifications">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                Sycophancy Reduction
              </h3>
              <p className="text-sm text-gray-400">
                Third-person prediction framing, calibration anchors, explicit
                rejection permission, and anti-central-tendency instructions —
                designed by humans based on published research (arxiv:2512.22725,
                TACL 2024).
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                Statistical Implementations
              </h3>
              <p className="text-sm text-gray-400">
                Mann-Whitney U, Kruskal-Wallis H, bootstrap CIs, and
                Krippendorff&apos;s alpha — hand-coded in TypeScript without
                external statistical libraries.
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                Acquiescence Bias Correction
              </h3>
              <p className="text-sm text-gray-400">
                Deterministic post-hoc correction that deflates responses when
                &gt;80% of a respondent&apos;s Likert answers are 4-5. Pure
                code, not AI.
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                Persona Profiles & Seeds
              </h3>
              <p className="text-sm text-gray-400">
                13 variation seeds hand-designed based on SoCal homeowner
                demographics. 8 of 13 are explicitly skeptical to counteract LLM
                positivity bias.
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                Survey Schema Design
              </h3>
              <p className="text-sm text-gray-400">
                Question structure follows established market research
                methodology — Likert scales, forced-choice, and MaxDiff-style
                concept testing.
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                Benchmark Validation
              </h3>
              <p className="text-sm text-gray-400">
                Results compared against real aytm survey data (N=600 US
                homeowners) to measure synthetic-to-real alignment gaps.
              </p>
            </div>
          </div>
        </Section>

        {/* Section 5: Responsible AI */}
        <Section title="Responsible AI Statement">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
            <p className="text-sm text-gray-300 mb-4">
              All data generated by this pipeline is clearly labeled as{" "}
              <strong className="text-white">synthetic</strong>. The pipeline
              produces N=90 survey respondents and N=30 depth interviews —
              synthetic personas that do not represent real people.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Limitations
                </h4>
                <ul className="space-y-1.5">
                  {[
                    "Synthetic responses exhibit systematic biases despite mitigation",
                    "Small sample sizes limit statistical power",
                    "LLM personas cannot capture full human complexity",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-400 flex items-start gap-2"
                    >
                      <span className="text-yellow-500 mt-0.5">!</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Safeguards
                </h4>
                <ul className="space-y-1.5">
                  {[
                    "Intended for hypothesis generation, not decision-grade data",
                    "Full traceability: discovery → themes → survey → results",
                    "Inter-model reliability reported for every metric",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-400 flex items-start gap-2"
                    >
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-6 mt-10 text-center text-xs text-gray-600">
          AYTM × Neo Smart Living — CPP AI Hackathon 2026
        </div>
      </div>
    </main>
  );
}
