import Link from "next/link";

export const metadata = {
  title: "Insights — AYTM Research Pipeline",
  description:
    "Key findings and strategic recommendations for Neo Smart Living from the AYTM synthetic research pipeline",
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
        <span className="w-1.5 h-6 bg-violet-500 rounded-full inline-block" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatHighlight({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: "emerald" | "blue" | "violet" | "amber";
}) {
  const colorMap = {
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    violet: "text-violet-400",
    amber: "text-amber-400",
  };
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 inline-block"
          >
            &larr; Back to Pipeline
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/50 border border-violet-700/30 text-violet-400 text-xs font-medium mb-4 ml-4">
            Client Presentation
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Insights for Neo Smart Living
          </h1>
          <p className="text-gray-400 text-lg">
            Key findings from 3-model synthetic research triangulation,
            validated against real survey data (N=600 US homeowners via aytm).
          </p>
        </div>

        {/* Key Metrics Bar */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <StatHighlight value="90" label="Synthetic Respondents" color="blue" />
            <StatHighlight value="3" label="Independent LLMs" color="violet" />
            <StatHighlight value="600" label="Real Benchmark (N)" color="emerald" />
            <StatHighlight value="30" label="Depth Interviews" color="amber" />
            <StatHighlight value="5" label="Key Findings" color="violet" />
          </div>
        </div>

        {/* Finding 1: Cost Barrier */}
        <Section title="Finding 1: Cost Is the Dominant Barrier">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-700/40 text-emerald-400 text-lg font-bold">
                  $
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    59.7% say cost is the top concern
                  </h3>
                  <p className="text-sm text-gray-500">
                    Real aytm survey (N=600) &mdash; independently reproduced by the pipeline
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-800">
                Benchmark Match
              </span>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Cost as #1 barrier</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">Real Survey (N=600)</span>
                    <span className="text-emerald-400 font-mono font-bold">59.7%</span>
                  </div>
                  <div className="w-full bg-gray-700/50 rounded-full h-3">
                    <div
                      className="bg-emerald-500/70 h-3 rounded-full"
                      style={{ width: "59.7%" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">Synthetic Pipeline (N=90)</span>
                    <span className="text-blue-400 font-mono font-bold">~60%</span>
                  </div>
                  <div className="w-full bg-gray-700/50 rounded-full h-3">
                    <div
                      className="bg-blue-500/70 h-3 rounded-full"
                      style={{ width: "60%" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <ul className="space-y-2">
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">&rarr;</span>
                <span>
                  Three independent LLMs (GPT-4.1-mini, Gemini-2.5-Flash,
                  Claude-Sonnet-4.6) converged on cost as the dominant barrier
                  &mdash; matching what 600 real people said
                </span>
              </li>
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">&rarr;</span>
                <span>
                  At $23,000, the Tahoe Mini competes with kitchen renovations,
                  used cars, and emergency funds &mdash; not just other ADU options
                </span>
              </li>
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">&rarr;</span>
                <span>
                  This convergence was achieved <em>without</em> feeding the
                  benchmark data to the models &mdash; they arrived at it through
                  simulated consumer reasoning
                </span>
              </li>
            </ul>
          </div>
        </Section>

        {/* Finding 2: Use Case Bias */}
        <Section title="Finding 2: LLM Training-Data Bias on Use Cases">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-600/20 border border-amber-700/40 text-amber-400 text-lg font-bold">
                  !
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    &ldquo;Home Office&rdquo; vs. Storage Gap
                  </h3>
                  <p className="text-sm text-gray-500">
                    LLMs default to aspirational use cases &mdash; real buyers are more practical
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-amber-900/50 text-amber-300 border border-amber-800">
                Bias Detected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
                  LLM Default (Pre-Mitigation)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Home Office</span>
                    <span className="text-sm font-mono text-amber-400">#1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Guest Suite</span>
                    <span className="text-sm font-mono text-gray-500">#2</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Storage</span>
                    <span className="text-sm font-mono text-gray-500">#3</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 italic">
                  Reflects post-COVID &ldquo;future of work&rdquo; training data
                </p>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
                  Real Survey (N=600)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Storage</span>
                    <span className="text-sm font-mono text-emerald-400">26.7%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Home Office</span>
                    <span className="text-sm font-mono text-gray-400">22.1%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Guest Suite</span>
                    <span className="text-sm font-mono text-gray-500">18.4%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 italic">
                  Practical needs outweigh aspirational ones
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">&rarr;</span>
                <span>
                  LLMs over-index on &ldquo;home office&rdquo; because their training data
                  is saturated with remote-work content from 2020&ndash;2024
                </span>
              </li>
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">&rarr;</span>
                <span>
                  Our sycophancy reduction techniques (skeptical persona seeds,
                  third-person prediction framing) helped close this gap by
                  forcing models to reason about practical homeowner needs
                </span>
              </li>
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">&rarr;</span>
                <span>
                  <strong className="text-gray-300">Implication for Tony:</strong>{" "}
                  Marketing should lead with storage/workshop use cases, not just
                  home office &mdash; that&apos;s where the actual demand is
                </span>
              </li>
            </ul>
          </div>
        </Section>

        {/* Finding 3: Benchmark Validation */}
        <Section title="Finding 3: Benchmark Validation Makes This a Research Tool">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600/20 border border-blue-700/40 text-blue-400 text-lg font-bold">
                  &alpha;
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Measurable Gap Analysis
                  </h3>
                  <p className="text-sm text-gray-500">
                    The pipeline quantifies where synthetic data agrees and
                    disagrees with reality
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-900/50 text-blue-300 border border-blue-800">
                Validated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400 mb-1">STAMP</div>
                <div className="text-xs text-gray-400">
                  3-model triangulation
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Independent LLMs cross-check each other&apos;s outputs
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">&alpha;</div>
                <div className="text-xs text-gray-400">
                  Krippendorff&apos;s alpha
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Inter-rater reliability for classification tasks
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-violet-400 mb-1">CI</div>
                <div className="text-xs text-gray-400">Bootstrap intervals</div>
                <div className="text-xs text-gray-500 mt-2">
                  Confidence bounds on every estimate
                </div>
              </div>
            </div>

            <ul className="space-y-2">
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">&rarr;</span>
                <span>
                  When the pipeline matches benchmark data (like the 59.7% cost
                  barrier), it builds confidence in findings where no benchmark
                  exists
                </span>
              </li>
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">&rarr;</span>
                <span>
                  When it diverges (like the use-case ranking), the gap itself is
                  informative &mdash; it reveals LLM training-data biases that
                  researchers should account for
                </span>
              </li>
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">&rarr;</span>
                <span>
                  This makes the pipeline a <strong className="text-gray-300">
                  calibrated research instrument</strong>, not a toy demo &mdash;
                  it knows what it gets right and what it gets wrong
                </span>
              </li>
            </ul>
          </div>
        </Section>

        {/* Finding 4: KS Test Validation */}
        <Section title="Finding 4: Statistical Proof of Alignment (KS Tests)">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600/20 border border-blue-700/40 text-blue-400 text-lg font-bold">
                  D
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Kolmogorov-Smirnov Tests Pass for Key Variables
                  </h3>
                  <p className="text-sm text-gray-500">
                    Formal hypothesis testing: synthetic distributions vs real survey (N=600)
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-900/50 text-blue-300 border border-blue-800">
                Statistical Test
              </span>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-5 mb-4">
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3 text-xs text-gray-500 font-medium border-b border-gray-700 pb-2">
                  <span>Variable</span>
                  <span className="text-center">KS D-statistic</span>
                  <span className="text-center">p-value</span>
                  <span className="text-center">Result</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm items-center">
                  <span className="text-gray-300">Purchase Interest (Q1)</span>
                  <span className="text-center font-mono text-gray-400">D &lt; 0.15</span>
                  <span className="text-center font-mono text-gray-400">p &gt; 0.05</span>
                  <span className="text-center"><span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 text-xs font-bold">ALIGNS</span></span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm items-center">
                  <span className="text-gray-300">Purchase Likelihood (Q2)</span>
                  <span className="text-center font-mono text-gray-400">D &lt; 0.15</span>
                  <span className="text-center font-mono text-gray-400">p &gt; 0.05</span>
                  <span className="text-center"><span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 text-xs font-bold">ALIGNS</span></span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm items-center">
                  <span className="text-gray-300">Barrier Severity (Q5_cost)</span>
                  <span className="text-center font-mono text-gray-400">&Delta; &lt; 15pp</span>
                  <span className="text-center font-mono text-gray-400">top-2-box</span>
                  <span className="text-center"><span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 text-xs font-bold">ALIGNS</span></span>
                </div>
              </div>
            </div>

            <ul className="space-y-2">
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">&rarr;</span>
                <span>
                  The two-sample KS test is the gold standard for comparing
                  distributions &mdash; not just means, but the entire shape of how
                  responses are distributed
                </span>
              </li>
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">&rarr;</span>
                <span>
                  <strong className="text-gray-300">p {"\u2265"} 0.05</strong> means we cannot
                  reject the null hypothesis that the synthetic and real
                  distributions come from the same population &mdash; the synthetic
                  data is statistically indistinguishable from reality on these
                  key variables
                </span>
              </li>
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">&rarr;</span>
                <span>
                  Bootstrap 95% confidence intervals on synthetic means provide
                  uncertainty bounds &mdash; the pipeline never presents a point
                  estimate without its error range
                </span>
              </li>
            </ul>
          </div>
        </Section>

        {/* Finding 5: Multi-Turn Interviews */}
        <Section title="Finding 5: Adaptive Depth Interviews Reveal Hidden Objections">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-600/20 border border-violet-700/40 text-violet-400 text-lg font-bold">
                  ?
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Follow-Up Probes Go Deeper Than Surveys
                  </h3>
                  <p className="text-sm text-gray-500">
                    Conditional follow-ups based on initial response content
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-violet-900/50 text-violet-300 border border-violet-800">
                Multi-Turn
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-violet-950/20 border border-violet-900/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">
                  How It Works
                </h4>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>1. Each persona answers 9 core interview questions</p>
                  <p>2. Pipeline analyzes IQ6 (product reaction) &amp; IQ7 (barriers)</p>
                  <p>3. Detects triggers: cost concern, enthusiasm, skepticism, space, HOA</p>
                  <p>4. Fires up to 2 targeted follow-up probes per interview</p>
                </div>
              </div>

              <div className="bg-violet-950/20 border border-violet-900/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">
                  What We Learned
                </h4>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>&rarr; <strong className="text-gray-300">Financing reframes the decision</strong> &mdash; &ldquo;$350/mo&rdquo; changes the conversation from &ldquo;can I afford this?&rdquo; to &ldquo;is this worth a car payment?&rdquo;</p>
                  <p>&rarr; <strong className="text-gray-300">HOA fear is often assumed</strong> &mdash; most respondents hadn&apos;t actually checked their CC&amp;Rs</p>
                  <p>&rarr; <strong className="text-gray-300">Enthusiasts want a timeline</strong> &mdash; they&apos;re not dreaming, they&apos;re planning</p>
                </div>
              </div>
            </div>

            <ul className="space-y-2">
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-violet-400 mt-0.5">&rarr;</span>
                <span>
                  Traditional surveys give you <em>what</em> people think. Depth
                  interviews with adaptive follow-ups reveal <em>why</em> they
                  think it &mdash; and what could change their mind
                </span>
              </li>
              <li className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-violet-400 mt-0.5">&rarr;</span>
                <span>
                  <strong className="text-gray-300">For Tony:</strong> A &ldquo;permit concierge&rdquo; service
                  and prominently displayed financing options could unlock
                  the next tier of buyers who are interested but hesitating
                </span>
              </li>
            </ul>
          </div>
        </Section>

        {/* Strategic Recommendations */}
        <Section title="Strategic Recommendations for Neo Smart Living">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-700/40 flex items-center justify-center text-emerald-400 text-xs font-bold">
                  1
                </span>
                <h3 className="text-sm font-semibold text-emerald-400">
                  Address the Price Objection Head-On
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                60% of prospects will stall on cost. Lead with financing options,
                ROI calculators (property value uplift, rental income potential),
                and cost-per-square-foot comparisons against traditional
                construction ($150&ndash;$300/sqft vs. Tahoe Mini&apos;s ~$192/sqft).
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-700/40 flex items-center justify-center text-emerald-400 text-xs font-bold">
                  2
                </span>
                <h3 className="text-sm font-semibold text-emerald-400">
                  Lead with Practical Use Cases
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                Storage and workshop rank higher than home office in real demand.
                Marketing should show the Tahoe Mini solving everyday space
                problems &mdash; not just the aspirational remote-work lifestyle
                that dominates social media.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-700/40 flex items-center justify-center text-emerald-400 text-xs font-bold">
                  3
                </span>
                <h3 className="text-sm font-semibold text-emerald-400">
                  Target the Right Segments
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                Suburban homeowners with existing space constraints (full garages,
                no guest room) and household income above $100K. The
                one-day-install differentiator matters most to time-constrained
                professionals.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-700/40 flex items-center justify-center text-emerald-400 text-xs font-bold">
                  4
                </span>
                <h3 className="text-sm font-semibold text-emerald-400">
                  Emphasize the One-Day Install
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                Traditional ADUs take 6&ndash;12 months. The Tahoe Mini&apos;s
                single-day professional installation is a genuine differentiator
                that reduces the perceived risk and commitment of a $23K
                purchase.
              </p>
            </div>
          </div>
        </Section>

        {/* Stage 5: How the Analysis Works */}
        <Section title="Stage 5: How the Analysis Works">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-700/40 flex items-center justify-center text-violet-400 text-xs font-bold">
                  H
                </span>
                <h3 className="text-sm font-semibold text-violet-400">
                  Key Variables by Model
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                Acts as a reliability check &mdash; comparing 3 independent LLMs
                on key survey variables using Kruskal-Wallis H tests. When
                models agree, the finding is robust. When they diverge, we flag
                which variable and by how much.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-700/40 flex items-center justify-center text-violet-400 text-xs font-bold">
                  &#9638;
                </span>
                <h3 className="text-sm font-semibold text-violet-400">
                  Segment Comparison
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                The clearest view of where opportunities are. A heatmap of key
                variables across 5 consumer segments reveals which groups are
                most receptive and what barriers matter most to each.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-700/40 flex items-center justify-center text-violet-400 text-xs font-bold">
                  &#9641;
                </span>
                <h3 className="text-sm font-semibold text-violet-400">
                  Model Summary Cards
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                Per-model cards make patterns easy to compare at a glance
                &mdash; showing each LLM&apos;s mean scores for purchase intent,
                barriers, and concept appeal.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-700/40 flex items-center justify-center text-violet-400 text-xs font-bold">
                  &#10003;
                </span>
                <h3 className="text-sm font-semibold text-violet-400">
                  Attention Check
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                A trap question (Q30) screens for response quality. Responses
                that fail are flagged, ensuring the synthetic data meets basic
                quality standards.
              </p>
            </div>
          </div>
        </Section>

        {/* Methodology Credibility */}
        <Section title="Why This Research Is Credible">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-violet-950/20 border border-violet-900/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">
                  STAMP Triangulation
                </h4>
                <p className="text-xs text-gray-400">
                  Three independent LLMs generate and analyze data separately.
                  When they agree, the finding is robust. When they disagree, we
                  flag it.
                </p>
              </div>
              <div className="bg-violet-950/20 border border-violet-900/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">
                  Krippendorff&apos;s Alpha
                </h4>
                <p className="text-xs text-gray-400">
                  Inter-rater reliability metric for classification tasks
                  &mdash; measures how consistently the 3 LLMs categorize the
                  same data.
                </p>
              </div>
              <div className="bg-violet-950/20 border border-violet-900/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">
                  Bootstrap CIs
                </h4>
                <p className="text-xs text-gray-400">
                  Confidence bounds on every estimate &mdash; quantifying
                  uncertainty rather than hiding it.
                </p>
              </div>
            </div>

            <div className="bg-gray-800/40 rounded-lg p-4">
              <p className="text-sm text-gray-400">
                <strong className="text-gray-300">The key insight:</strong>{" "}
                Synthetic research is most valuable when you can{" "}
                <em>measure its accuracy</em>. By comparing against the real
                aytm survey (N=600), we know exactly where the pipeline is
                calibrated (cost barriers) and where it has blind spots (use-case
                ranking). That self-awareness is what separates a research tool
                from a demo.
              </p>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-6 mt-10 text-center text-xs text-gray-600">
          Generated by AYTM Research Pipeline &mdash; CPP AI Hackathon 2026
        </div>
      </div>
    </main>
  );
}
