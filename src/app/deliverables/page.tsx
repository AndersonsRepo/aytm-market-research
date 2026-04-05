import Link from "next/link";

export const metadata = {
  title: "Deliverables — AYTM Research Pipeline",
  description: "Growth strategy, responsible AI statement, and measurement plan for Neo Smart Living",
};

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" />
          {title}
        </h2>
        {badge && (
          <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-900/50 text-blue-300 border border-blue-800">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 mb-4">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function DeliverablesPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 inline-block">
            &larr; Back to Pipeline
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Deliverables</h1>
          <p className="text-gray-400 text-lg">
            Growth strategy, responsible AI framework, and measurement plan derived from
            the 3-model synthetic research pipeline.
          </p>
        </div>

        {/* Growth Strategy */}
        <Section title="Growth Strategy for Neo Smart Living" badge="STRATEGIC">
          <Card title="Target Segment Prioritization">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-4">
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Tier 1 — Immediate</div>
                <div className="text-sm font-medium text-white mb-1">Budget-Conscious DIYers</div>
                <p className="text-xs text-gray-400">
                  Practical storage needs, price-sensitive. Lead with financing ($350/mo),
                  permit-light, and &ldquo;premium shed&rdquo; framing. Storage is their #1 use case (27% of market).
                </p>
              </div>
              <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-4">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Tier 2 — Growth</div>
                <div className="text-sm font-medium text-white mb-1">Wellness Seekers &amp; Remote Workers</div>
                <p className="text-xs text-gray-400">
                  Aspirational buyers with clear use cases. Target with wellness studio and
                  home office concepts. Higher income, lower price sensitivity.
                </p>
              </div>
              <div className="bg-violet-950/20 border border-violet-900/30 rounded-lg p-4">
                <div className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Tier 3 — Premium</div>
                <div className="text-sm font-medium text-white mb-1">Property Maximizers</div>
                <p className="text-xs text-gray-400">
                  ROI-focused buyers interested in guest suite / STR income. Highest willingness
                  to pay but concerned about HOA, permits, and resale value.
                </p>
              </div>
            </div>
          </Card>

          <Card title="Go-to-Market Recommendations">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-700/40 text-emerald-400 text-xs font-bold shrink-0 mt-0.5">1</span>
                <div>
                  <div className="text-sm font-medium text-white">Lead with Storage, Not Home Office</div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Real survey data shows storage/premium shed is the #1 use case (26.7%) — ahead of home office (18.0%).
                    Marketing should highlight practical storage overflow, workshop space, and gear organization before aspirational use cases.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-700/40 text-emerald-400 text-xs font-bold shrink-0 mt-0.5">2</span>
                <div>
                  <div className="text-sm font-medium text-white">Address Cost Barrier with Financing Front &amp; Center</div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    59.7% cite cost as the #1 barrier. Financing options ($350/mo over 6 years) must be
                    above the fold — not buried in a FAQ. ROI calculators showing property value uplift and potential STR income can reframe the decision.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-700/40 text-emerald-400 text-xs font-bold shrink-0 mt-0.5">3</span>
                <div>
                  <div className="text-sm font-medium text-white">Offer a &ldquo;Permit Concierge&rdquo; Service</div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Depth interviews revealed most HOA concerns are assumptions, not verified restrictions.
                    A white-glove permit/HOA navigation service could unlock 5-8% of hesitant buyers.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-700/40 text-emerald-400 text-xs font-bold shrink-0 mt-0.5">4</span>
                <div>
                  <div className="text-sm font-medium text-white">YouTube-First Content Strategy</div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Real survey shows YouTube (36.2%) and home improvement expos (30.8%) are the top discovery channels.
                    Invest in install timelapse videos, customer testimonials, and cost-comparison breakdowns on YouTube before paid social.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-700/40 text-emerald-400 text-xs font-bold shrink-0 mt-0.5">5</span>
                <div>
                  <div className="text-sm font-medium text-white">Price Optimization: Consider a $15K Entry Model</div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Van Konan analysis shows revenue maximizes at $15K (240 buyers vs 110 at $23K).
                    A smaller or stripped-down entry model at $12-15K could 2x the buyer pool while
                    the Tahoe Mini serves as the premium tier.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* Responsible AI Statement */}
        <Section title="Responsible AI Statement" badge="ETHICS">
          <Card title="Transparency &amp; Limitations">
            <div className="space-y-4">
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-4">
                <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Data Source Declaration</div>
                <p className="text-xs text-gray-400">
                  All survey responses and depth interviews in this pipeline are <strong className="text-white">synthetically generated</strong> by
                  three frontier LLMs (GPT-4.1-mini, Gemini-2.5-Flash, Claude-Sonnet-4.6). No real consumer data was collected or used
                  beyond the benchmark comparison dataset (N=600 US homeowners via aytm, provided by the hackathon organizers).
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white">Known Limitations</h4>
                <ul className="space-y-2">
                  <li className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">&bull;</span>
                    <span><strong className="text-gray-300">Positivity bias:</strong> LLMs tend to generate more favorable responses than real consumers. We mitigate this with skeptical persona seeds (8 of 13 variation types are explicitly negative) and third-person prediction framing.</span>
                  </li>
                  <li className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">&bull;</span>
                    <span><strong className="text-gray-300">Training data bias:</strong> LLMs over-index on &ldquo;home office&rdquo; as a use case due to post-COVID training data saturation. Real consumers prioritize storage (26.7% vs 18.0%). We document this divergence transparently.</span>
                  </li>
                  <li className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">&bull;</span>
                    <span><strong className="text-gray-300">Small sample size:</strong> N=90 synthetic respondents limits statistical power. Bootstrap confidence intervals quantify uncertainty on every estimate.</span>
                  </li>
                  <li className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">&bull;</span>
                    <span><strong className="text-gray-300">No emotional authenticity:</strong> Synthetic personas simulate decision-making patterns but cannot replicate the emotional complexity of real purchase decisions. Depth interview follow-ups help but are fundamentally constrained.</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white">Bias Mitigation Techniques</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs font-medium text-blue-400 mb-1">Third-Person Prediction Framing</div>
                    <p className="text-[10px] text-gray-500">&ldquo;Predict how this consumer would respond&rdquo; vs. &ldquo;You are this consumer&rdquo; — reduces sycophancy by 15-20%</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs font-medium text-blue-400 mb-1">STAMP Codebook Prompts</div>
                    <p className="text-[10px] text-gray-500">Per-question calibration anchors with boundary cases and exclusion criteria — aligns model output to real distributions</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs font-medium text-blue-400 mb-1">Anti-Central-Tendency Instructions</div>
                    <p className="text-[10px] text-gray-500">Explicit instructions against defaulting to 3/neutral — forces polarized responses matching real consumer behavior</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs font-medium text-blue-400 mb-1">Acquiescence Correction</div>
                    <p className="text-[10px] text-gray-500">Post-hoc deflation when &gt;80% of a respondent&apos;s Likert answers are 4-5 — catches overly positive response patterns</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Intended Use &amp; Scope">
            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-4 mb-3">
              <p className="text-xs text-gray-400">
                <strong className="text-emerald-300">Appropriate uses:</strong> Hypothesis generation, early-stage concept exploration,
                research methodology demonstration, identifying areas for deeper real-consumer research.
              </p>
            </div>
            <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4">
              <p className="text-xs text-gray-400">
                <strong className="text-red-300">NOT appropriate for:</strong> Decision-grade market data, pricing decisions without
                real validation, replacing real consumer research, regulatory submissions, or any context where
                synthetic data could be mistaken for real consumer responses.
              </p>
            </div>
          </Card>
        </Section>

        {/* Measurement Plan */}
        <Section title="Measurement Plan" badge="VALIDATION">
          <Card title="Pipeline Quality Metrics">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-2 pr-3 font-medium">Metric</th>
                    <th className="text-center py-2 px-3 font-medium">Target</th>
                    <th className="text-center py-2 px-3 font-medium">Method</th>
                    <th className="text-left py-2 pl-3 font-medium">Why It Matters</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2.5 pr-3 font-medium">Krippendorff&apos;s &alpha;</td>
                    <td className="py-2.5 px-3 text-center font-mono">&ge; 0.68</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">Inter-LLM reliability</td>
                    <td className="py-2.5 pl-3 text-gray-400">STAMP threshold — confirms models produce consistent classifications</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2.5 pr-3 font-medium">Benchmark Alignment</td>
                    <td className="py-2.5 px-3 text-center font-mono">&plusmn;5pp</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">KS test + distribution delta</td>
                    <td className="py-2.5 pl-3 text-gray-400">5 key questions must be within 5 percentage points of real survey</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2.5 pr-3 font-medium">Use Case Ranking</td>
                    <td className="py-2.5 px-3 text-center font-mono">Storage #1</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">Q3 distribution</td>
                    <td className="py-2.5 pl-3 text-gray-400">LLM bias test — training data predicts home office, reality shows storage</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2.5 pr-3 font-medium">Price Resistance Mean</td>
                    <td className="py-2.5 px-3 text-center font-mono">2.34 &plusmn; 0.3</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">Q1 mean + bootstrap CI</td>
                    <td className="py-2.5 pl-3 text-gray-400">Most critical calibration — must capture that most consumers are NOT interested at $23K</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2.5 pr-3 font-medium">Cost Barrier Dominance</td>
                    <td className="py-2.5 px-3 text-center font-mono">55-65%</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">Q6 proportion</td>
                    <td className="py-2.5 pl-3 text-gray-400">Real data: 59.7% cite cost. Pipeline must capture this dominance.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-medium">&ldquo;None&rdquo; Concept Rate</td>
                    <td className="py-2.5 px-3 text-center font-mono">20-28%</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">Q14 proportion</td>
                    <td className="py-2.5 pl-3 text-gray-400">Real: 24% reject all concepts. Tests if pipeline captures genuine disinterest.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Continuous Improvement Framework">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-700/40 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">L1</span>
                <div>
                  <div className="text-sm font-medium text-white">Run → Compare → Adjust</div>
                  <p className="text-xs text-gray-400">Each pipeline run auto-compares against the N=600 benchmark. KS tests and distribution deltas flag where prompts need recalibration.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-700/40 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">L2</span>
                <div>
                  <div className="text-sm font-medium text-white">STAMP Disagreement as Signal</div>
                  <p className="text-xs text-gray-400">When models disagree (low alpha), it reveals construct ambiguity. These disagreement points become the next iteration&apos;s codebook refinement targets.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-700/40 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">L3</span>
                <div>
                  <div className="text-sm font-medium text-white">Benchmark Expansion</div>
                  <p className="text-xs text-gray-400">As more real surveys become available, the benchmark set grows. The pipeline&apos;s validation layer is designed to ingest new benchmark data without code changes.</p>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-6 mt-10 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            Generated by AYTM Research Pipeline &mdash; CPP AI Hackathon 2026
          </span>
          <div className="flex gap-3">
            <Link href="/insights" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              Insights &rarr;
            </Link>
            <Link href="/methodology" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Methodology &rarr;
            </Link>
            <Link href="/genai" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              GenAI Docs &rarr;
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
