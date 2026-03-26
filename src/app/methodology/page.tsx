import Link from "next/link";

export const metadata = {
  title: "Methodology — AYTM Research Pipeline",
  description: "Bias mitigation techniques used to align synthetic survey responses with real consumer behavior",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

function TechniqueCard({
  number,
  title,
  file,
  impact,
  description,
  details,
  citation,
}: {
  number: number;
  title: string;
  file: string;
  impact: string;
  description: string;
  details: string[];
  citation?: string;
}) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
            {number}
          </span>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-800">
          {impact}
        </span>
      </div>
      <p className="text-sm text-gray-300 mb-3">{description}</p>
      <ul className="space-y-1.5 mb-3">
        {details.map((d, i) => (
          <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">→</span>
            <span>{d}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <code className="bg-gray-800 px-2 py-0.5 rounded">{file}</code>
        {citation && <span className="italic">{citation}</span>}
      </div>
    </div>
  );
}

function ComparisonRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <tr className="border-b border-gray-800">
      <td className="py-3 pr-4 text-sm text-gray-300 font-medium">{label}</td>
      <td className="py-3 px-4 text-sm text-red-400">{before}</td>
      <td className="py-3 px-4 text-sm text-emerald-400">{after}</td>
    </tr>
  );
}

export default function MethodologyPage() {
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
            Bias Mitigation Methodology
          </h1>
          <p className="text-gray-400 text-lg">
            How we reduced LLM positivity bias in synthetic survey responses to better align with real consumer behavior.
          </p>
        </div>

        {/* Problem Statement */}
        <Section title="The Problem: Systematic Positivity Bias">
          <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-6 mb-4">
            <p className="text-sm text-gray-300 mb-4">
              Our initial pipeline generated synthetic survey responses that were{" "}
              <strong className="text-red-400">dramatically more positive</strong> than
              real consumer data (N=600 US homeowners via aytm). LLMs exhibit well-documented
              sycophancy — a tendency to produce agreeable, positive outputs reinforced by RLHF training.
              When role-playing as survey respondents, this compounds with the &quot;helpful assistant&quot;
              disposition, creating unrealistic enthusiasm.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 text-gray-400 font-medium">Metric</th>
                    <th className="text-left py-2 text-red-400 font-medium">Before (Synthetic)</th>
                    <th className="text-left py-2 text-gray-400 font-medium">Real (N=600)</th>
                    <th className="text-left py-2 text-gray-400 font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 text-gray-300">Purchase Interest (rated 4-5)</td>
                    <td className="py-2 text-red-400 font-mono">95.5%</td>
                    <td className="py-2 text-gray-400 font-mono">23.4%</td>
                    <td className="py-2 text-red-400 font-mono">+72pp</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 text-gray-300">Purchase Likelihood (rated 4-5)</td>
                    <td className="py-2 text-red-400 font-mono">~80%</td>
                    <td className="py-2 text-gray-400 font-mono">~15%</td>
                    <td className="py-2 text-red-400 font-mono">+65pp</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 text-gray-300">&quot;None of the above&quot; for concepts</td>
                    <td className="py-2 text-red-400 font-mono">0%</td>
                    <td className="py-2 text-gray-400 font-mono">24%</td>
                    <td className="py-2 text-red-400 font-mono">-24pp</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-300">Inter-LLM Reliability (Krippendorff&apos;s α)</td>
                    <td className="py-2 text-red-400 font-mono">0.135</td>
                    <td className="py-2 text-gray-400 font-mono">≥0.667 target</td>
                    <td className="py-2 text-red-400 font-mono">Poor</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* Techniques */}
        <Section title="Mitigation Techniques Applied">
          <p className="text-sm text-gray-400 mb-6">
            All techniques are <strong className="text-gray-300">product-agnostic</strong> — they work
            for any novel product without requiring real benchmark data as input. This is critical because
            the pipeline is designed for products that don&apos;t yet have real survey data.
          </p>

          <TechniqueCard
            number={1}
            title="Third-Person Prediction Framing"
            file="stage4.ts → buildSystemPrompt()"
            impact="Est. −10-15pp"
            description='Changed the LLM framing from "You are role-playing as a synthetic survey respondent" to "You are predicting how a real consumer would respond." This shifts the model from role-play mode (where sycophancy dominates) to prediction mode (where it can reason about realistic base rates).'
            details={[
              "Role-play elicits the model's 'helpful assistant' disposition → inflated positivity",
              "Prediction framing activates the model's world knowledge about consumer behavior",
              "The model can reason about base rates without being told specific numbers",
            ]}
            citation="Mitigating Social Desirability Bias in Random Silicon Sampling (arxiv:2512.22725)"
          />

          <TechniqueCard
            number={2}
            title="Explicit Rejection Permission & Category-Level Base Rates"
            file="stage4.ts → buildSystemPrompt()"
            impact="Est. −10-15pp"
            description="Added 9 realism rules explicitly telling the model that low ratings are expected, 'none of the above' is common, and $23K is a major purchase. Uses behavioral principles from survey methodology (status quo bias, financial constraints, satisficing) rather than product-specific data."
            details={[
              "RLHF-trained models avoid disagreement unless explicitly permitted to do so",
              "Medical AI research shows explicit rejection permission increases disagreement rates up to 94%",
              "Guidance references general consumer psychology (competing priorities, status quo bias) without citing specific rates",
              "Instructs models to limit strong opinions to 2-3 per respondent, matching real consumer behavior",
            ]}
            citation="LLM sycophancy research; TACL 2024 survey response bias study"
          />

          <TechniqueCard
            number={3}
            title="Skeptical Persona Variation Seeds"
            file="constants.ts → VARIATION_SEEDS"
            impact="Est. −10-15pp"
            description="Expanded variation seeds from 6 (all positive/neutral) to 13 (5 positive + 8 skeptical). New seeds introduce financial constraints, decision fatigue, satisfaction with current setup, risk-aversion, and frugality — representing the ~75% of real consumers who are not in-market buyers."
            details={[
              'Original seeds: "early adopter", "design-conscious", "social" — all positively disposed',
              'New seeds: "managing significant expenses", "satisfied with current setup", "reads negative reviews first"',
              "Each synthetic respondent is assigned one seed, creating natural distribution variation",
              "Skeptical seeds produce low ratings without hard-coding specific response values",
            ]}
          />

          <TechniqueCard
            number={4}
            title="Response Distribution Guidance"
            file="stage4.ts → buildUserPrompt()"
            impact="Est. −5-10pp"
            description='Added per-question guidance in the user prompt reminding models to use the full 1-5 Likert scale, be conservative on purchase intent, and consider "None of the above" for concept preference.'
            details={[
              "Q1/Q2 (purchase intent/likelihood): explicitly framed as $23K discretionary purchase",
              'Q14 (best concept): "select None if no concept is worth $23K to this consumer"',
              'Q6 (barrier): "No concerns" reserved for genuinely enthusiastic, financially comfortable consumers',
              "Q3 (use case): pick ONE most relevant, not aspirational uses",
            ]}
          />

          <TechniqueCard
            number={5}
            title="Post-Hoc Acquiescence Bias Correction"
            file="stage4.ts → validateResponse()"
            impact="Est. −5-10pp"
            description="Deterministic safety net: if >80% of a respondent's Likert answers are 4-5, non-barrier responses are deflated by 1 point (5→4, 4→3). Barrier keys (Q5_*) are exempt because high barrier ratings represent realistic concerns."
            details={[
              "Detects acquiescence bias (tendency to agree with everything) algorithmically",
              "Only triggers for extreme cases (>80% positive) to avoid over-correction",
              "Barrier questions excluded — rating cost and HOA restrictions as high concerns is realistic",
              "Applied after LLM generation as a deterministic validation step, not an LLM call",
            ]}
            citation="Do LLMs Exhibit Human-like Response Biases? (TACL 2024)"
          />
        </Section>

        {/* Design Principles */}
        <Section title="Design Principles">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">Product-Agnostic</h3>
              <p className="text-sm text-gray-400">
                No technique uses product-specific benchmark data. All corrections work from
                category-level consumer behavior patterns (high-ticket discretionary purchases)
                and general survey methodology principles.
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">Deterministic Where Possible</h3>
              <p className="text-sm text-gray-400">
                The acquiescence correction is pure code — no LLM involved. Prompt techniques
                guide the LLM, but the validation layer enforces constraints deterministically.
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">Transparent & Measurable</h3>
              <p className="text-sm text-gray-400">
                STAMP inter-LLM reliability (Krippendorff&apos;s α) and benchmark comparison
                provide quantitative evidence of how well corrections work. We report gaps honestly,
                not hide them.
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">Layered Defense</h3>
              <p className="text-sm text-gray-400">
                Five independent techniques at different points in the pipeline: prompt framing,
                persona construction, response guidance, variation seeds, and post-hoc correction.
                No single technique bears the full burden.
              </p>
            </div>
          </div>
        </Section>

        {/* STAMP */}
        <Section title="Measurement: STAMP Methodology">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
            <p className="text-sm text-gray-300 mb-4">
              We use Dr. Lin&apos;s <strong className="text-white">STAMP (Structured Taxonomy AI Measurement Protocol)</strong> to
              scientifically measure inter-LLM agreement. Three heterogeneous frontier models
              (GPT-4.1-mini, Gemini-2.5-Flash, Claude-Sonnet-4.6) independently generate responses
              for each persona. Agreement is measured via Krippendorff&apos;s alpha:
            </p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-red-400">α &lt; 0.667</div>
                <div className="text-xs text-gray-400 mt-1">Unreliable — models disagree</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-yellow-400">0.667 ≤ α &lt; 0.8</div>
                <div className="text-xs text-gray-400 mt-1">Acceptable agreement</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-emerald-400">α ≥ 0.8</div>
                <div className="text-xs text-gray-400 mt-1">Excellent reliability</div>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              Low α values are not failures — they are diagnostic signals showing where synthetic
              data is unreliable. This transparency is the core value proposition: instead of
              claiming synthetic data is always accurate, we measure and report exactly where it
              can and cannot be trusted.
            </p>
          </div>
        </Section>

        {/* References */}
        <Section title="References">
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-gray-600">[1]</span>
              <span>Mitigating Social Desirability Bias in Random Silicon Sampling — <em>arxiv:2512.22725</em></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600">[2]</span>
              <span>Do LLMs Exhibit Human-like Response Biases? A Case Study in Survey Design — <em>TACL 2024</em></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600">[3]</span>
              <span>LLMs Reproduce Human Purchase Intent via Semantic Similarity Elicitation of Likert Ratings — <em>arxiv:2510.08338</em></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600">[4]</span>
              <span>Valid Survey Simulations with Limited Human Data — <em>arxiv:2510.11408</em></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600">[5]</span>
              <span>Quantifying and Mitigating Socially Desirable Responding in LLMs — <em>arxiv:2602.17262</em></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600">[6]</span>
              <span>Dr. Lin — STAMP: Structured Taxonomy AI Measurement Protocol (YouTube presentation, 2026)</span>
            </li>
          </ul>
        </Section>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-6 mt-10 text-center text-xs text-gray-600">
          AYTM × Neo Smart Living — CPP AI Hackathon 2026
        </div>
      </div>
    </main>
  );
}
