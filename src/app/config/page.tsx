"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────

interface ConfigState {
  [section: string]: unknown;
}

const SECTION_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  questions: { label: "Questions", icon: "💬", description: "Interview & discovery questions" },
  personas: { label: "Personas", icon: "👤", description: "30 interview personas with demographics" },
  segments: { label: "Segments", icon: "📊", description: "Market segments & demographic options" },
  segmentProfiles: { label: "Profiles", icon: "📈", description: "Statistical response profiles per segment" },
  surveySchema: { label: "Survey Schema", icon: "📋", description: "Response schema & analytics keys" },
  founderBrief: { label: "Founder Brief", icon: "📝", description: "Product info & system prompts" },
  apiSettings: { label: "API Settings", icon: "⚙️", description: "Models, retries, temperature, concurrency" },
  benchmarks: { label: "Benchmarks", icon: "📉", description: "Real survey benchmark data" },
};

const SECTIONS = Object.keys(SECTION_LABELS);

// ─── Main Page ───────────────────────────────────────────────────────────

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [defaults, setDefaults] = useState<ConfigState | null>(null);
  const [overriddenSections, setOverriddenSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState("questions");
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load config
  useEffect(() => {
    Promise.all([
      fetch("/api/pipeline/config").then((r) => r.json()),
      fetch("/api/pipeline/config?defaults=true").then((r) => r.json()),
    ]).then(([live, def]) => {
      setConfig(live.config);
      setOverriddenSections(live.overriddenSections || []);
      setDefaults(def.config);
    });
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const updateSection = useCallback((section: string, value: unknown) => {
    setConfig((prev) => (prev ? { ...prev, [section]: value } : prev));
    setDirty((prev) => new Set(prev).add(section));
  }, []);

  const handleSave = async () => {
    if (!config || dirty.size === 0) return;
    setSaving(true);

    try {
      for (const section of dirty) {
        const res = await fetch("/api/pipeline/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, config: config[section] }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Failed to save ${section}`);
        }
      }
      setDirty(new Set());
      setOverriddenSections((prev) => [...new Set([...prev, ...dirty])]);
      showToast("Config saved successfully", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (section?: string) => {
    setResetting(true);
    try {
      const body = section ? { section } : { all: true };
      const res = await fetch("/api/pipeline/config/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Reset failed");

      // Reload defaults into config
      if (defaults) {
        if (section) {
          setConfig((prev) => (prev ? { ...prev, [section]: defaults[section] } : prev));
          setOverriddenSections((prev) => prev.filter((s) => s !== section));
          setDirty((prev) => { const n = new Set(prev); n.delete(section); return n; });
        } else {
          setConfig({ ...defaults });
          setOverriddenSections([]);
          setDirty(new Set());
        }
      }
      showToast(section ? `${SECTION_LABELS[section]?.label} reset to defaults` : "All sections reset to defaults", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setResetting(false);
    }
  };

  if (!config || !defaults) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
          toast.type === "success" ? "bg-green-600/90" : "bg-red-600/90"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-gray-200 transition-colors text-sm">
              ← Back to Pipeline
            </Link>
            <h1 className="text-xl font-semibold">Pipeline Configuration</h1>
            {dirty.size > 0 && (
              <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 text-xs rounded-full">
                {dirty.size} unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleReset()}
              disabled={resetting || overriddenSections.length === 0}
              className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {resetting ? "Resetting..." : "Reset All to Defaults"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || dirty.size === 0}
              className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar */}
        <nav className="w-56 flex-shrink-0">
          <div className="space-y-1 sticky top-24">
            {SECTIONS.map((section) => {
              const info = SECTION_LABELS[section];
              const isActive = activeSection === section;
              const isDirty = dirty.has(section);
              const isOverridden = overriddenSections.includes(section);

              return (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                      : "hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {info.icon} {info.label}
                    </span>
                    <span className="flex gap-1">
                      {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      {isOverridden && !isDirty && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main Editor Area */}
        <main className="flex-1 min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {SECTION_LABELS[activeSection]?.icon} {SECTION_LABELS[activeSection]?.label}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {SECTION_LABELS[activeSection]?.description}
              </p>
            </div>
            {overriddenSections.includes(activeSection) && (
              <button
                onClick={() => handleReset(activeSection)}
                className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
              >
                Reset to Default
              </button>
            )}
          </div>

          <SectionEditor
            section={activeSection}
            value={config[activeSection]}
            defaultValue={defaults[activeSection]}
            onChange={(val) => updateSection(activeSection, val)}
          />
        </main>
      </div>
    </div>
  );
}

// ─── Section Editor Router ───────────────────────────────────────────────

function SectionEditor({
  section,
  value,
  defaultValue,
  onChange,
}: {
  section: string;
  value: unknown;
  defaultValue: unknown;
  onChange: (val: unknown) => void;
}) {
  switch (section) {
    case "questions":
      return <QuestionsEditor value={value as any} onChange={onChange} />;
    case "personas":
      return <PersonasEditor value={value as any} onChange={onChange} />;
    case "segments":
      return <SegmentsEditor value={value as any} onChange={onChange} />;
    case "founderBrief":
      return <FounderBriefEditor value={value as any} onChange={onChange} />;
    case "apiSettings":
      return <ApiSettingsEditor value={value as any} onChange={onChange} />;
    case "surveySchema":
    case "segmentProfiles":
    case "benchmarks":
      return <JsonEditor value={value} onChange={onChange} label={SECTION_LABELS[section]?.label || section} />;
    default:
      return <JsonEditor value={value} onChange={onChange} label={section} />;
  }
}

// ─── Shared Components ───────────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors";
const textareaClass = `${inputClass} resize-y`;
const cardClass = "bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3";
const labelClass = "block text-xs font-medium text-gray-400 mb-1";

// ─── Questions Editor ────────────────────────────────────────────────────

function QuestionsEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const update = (field: string, key: string, val: string) => {
    onChange({
      ...value,
      [field]: { ...value[field], [key]: val },
    });
  };

  return (
    <div className="space-y-6">
      {/* Interview Questions */}
      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-300">Interview Questions (IQ1-IQ8)</h3>
        <div className="space-y-3">
          {Object.entries(value?.interviewQuestions || {}).map(([key, text]) => (
            <div key={key}>
              <label className={labelClass}>{key}</label>
              <textarea
                className={textareaClass}
                rows={2}
                value={text as string}
                onChange={(e) => update("interviewQuestions", key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Discovery Questions */}
      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-300">Discovery Questions (DQ1-DQ10)</h3>
        <div className="space-y-3">
          {Object.entries(value?.discoveryQuestions || {}).map(([key, text]) => (
            <div key={key}>
              <label className={labelClass}>{key}</label>
              <textarea
                className={textareaClass}
                rows={2}
                value={text as string}
                onChange={(e) => update("discoveryQuestions", key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Follow-up Probes */}
      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-300">Follow-up Probes</h3>
        <div className="space-y-4">
          {(value?.followUpProbes || []).map((probe: any, i: number) => (
            <div key={probe.id} className="bg-gray-800/50 rounded-lg p-3 space-y-2">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelClass}>ID</label>
                  <input className={inputClass} value={probe.id} readOnly />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>Trigger</label>
                  <select
                    className={inputClass}
                    value={probe.trigger}
                    onChange={(e) => {
                      const probes = [...value.followUpProbes];
                      probes[i] = { ...probes[i], trigger: e.target.value };
                      onChange({ ...value, followUpProbes: probes });
                    }}
                  >
                    {["cost_concern", "high_interest", "skepticism", "space_concern", "hoa_concern"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className={labelClass}>Target Question</label>
                  <input
                    className={inputClass}
                    value={probe.target}
                    onChange={(e) => {
                      const probes = [...value.followUpProbes];
                      probes[i] = { ...probes[i], target: e.target.value };
                      onChange({ ...value, followUpProbes: probes });
                    }}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Question</label>
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={probe.question}
                  onChange={(e) => {
                    const probes = [...value.followUpProbes];
                    probes[i] = { ...probes[i], question: e.target.value };
                    onChange({ ...value, followUpProbes: probes });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Personas Editor ─────────────────────────────────────────────────────

function PersonasEditor({ value, onChange }: { value: any[]; onChange: (v: any) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">{value?.length || 0} personas</p>
      {(value || []).map((persona: any, i: number) => (
        <div key={persona.persona_id} className={cardClass}>
          <button
            className="w-full flex items-center justify-between text-left"
            onClick={() => setExpanded(expanded === persona.persona_id ? null : persona.persona_id)}
          >
            <span className="text-sm font-medium">
              {persona.persona_id} — {persona.name}
              <span className="text-gray-500 ml-2">{persona.age} · {persona.income} · {persona.work_arrangement}</span>
            </span>
            <span className="text-gray-500">{expanded === persona.persona_id ? "▲" : "▼"}</span>
          </button>

          {expanded === persona.persona_id && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-800">
              {["name", "age", "income", "work_arrangement", "home_situation", "household", "lifestyle_note", "hoa_status"].map((field) => (
                <div key={field}>
                  <label className={labelClass}>{field.replace(/_/g, " ")}</label>
                  {field === "home_situation" || field === "lifestyle_note" ? (
                    <textarea
                      className={textareaClass}
                      rows={2}
                      value={persona[field] || ""}
                      onChange={(e) => {
                        const updated = [...value];
                        updated[i] = { ...updated[i], [field]: e.target.value };
                        onChange(updated);
                      }}
                    />
                  ) : field === "hoa_status" ? (
                    <select
                      className={inputClass}
                      value={persona[field]}
                      onChange={(e) => {
                        const updated = [...value];
                        updated[i] = { ...updated[i], [field]: e.target.value };
                        onChange(updated);
                      }}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="I'm not sure">I&apos;m not sure</option>
                    </select>
                  ) : (
                    <input
                      className={inputClass}
                      value={persona[field] || ""}
                      onChange={(e) => {
                        const updated = [...value];
                        updated[i] = { ...updated[i], [field]: e.target.value };
                        onChange(updated);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Segments Editor ─────────────────────────────────────────────────────

function SegmentsEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const segments = value?.segments || [];

  return (
    <div className="space-y-3">
      {segments.map((seg: any, i: number) => (
        <div key={seg.id} className={cardClass}>
          <button
            className="w-full flex items-center justify-between text-left"
            onClick={() => setExpanded(expanded === seg.id ? null : seg.id)}
          >
            <span className="text-sm font-medium">
              Segment {seg.id}: {seg.name}
            </span>
            <span className="text-gray-500">{expanded === seg.id ? "▲" : "▼"}</span>
          </button>

          {expanded === seg.id && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  className={inputClass}
                  value={seg.name}
                  onChange={(e) => {
                    const updated = { ...value, segments: [...segments] };
                    updated.segments[i] = { ...seg, name: e.target.value };
                    onChange(updated);
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>Psychographic</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={seg.psychographic}
                  onChange={(e) => {
                    const updated = { ...value, segments: [...segments] };
                    updated.segments[i] = { ...seg, psychographic: e.target.value };
                    onChange(updated);
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>Demographics (JSON)</label>
                <textarea
                  className={textareaClass}
                  rows={4}
                  value={JSON.stringify(seg.demographics, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      const updated = { ...value, segments: [...segments] };
                      updated.segments[i] = { ...seg, demographics: parsed };
                      onChange(updated);
                    } catch {
                      // Don't update on invalid JSON
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Founder Brief Editor ────────────────────────────────────────────────

function FounderBriefEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-300">Founder Brief</h3>
        <p className="text-xs text-gray-500">Product and market context given to LLMs during discovery and interview stages.</p>
        <textarea
          className={textareaClass}
          rows={20}
          value={value?.founderBrief || ""}
          onChange={(e) => onChange({ ...value, founderBrief: e.target.value })}
        />
      </div>
      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-300">Discovery System Prompt</h3>
        <p className="text-xs text-gray-500">System instruction for the Stage 1 discovery LLM calls.</p>
        <textarea
          className={textareaClass}
          rows={8}
          value={value?.discoverySystemPrompt || ""}
          onChange={(e) => onChange({ ...value, discoverySystemPrompt: e.target.value })}
        />
      </div>
    </div>
  );
}

// ─── API Settings Editor ─────────────────────────────────────────────────

function ApiSettingsEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const update = (field: string, val: unknown) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-300">Models</h3>
        <div className="space-y-2">
          {Object.entries(value?.models || {}).map(([id, info]: [string, any]) => (
            <div key={id} className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-3 py-2">
              <span className="text-xs font-mono text-gray-400 flex-1">{id}</span>
              <span className="text-sm">{info.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-300">API Parameters</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "maxRetries", label: "Max Retries", min: 0, max: 10, step: 1 },
            { key: "defaultTemperature", label: "Default Temperature", min: 0, max: 2, step: 0.1 },
            { key: "defaultMaxTokens", label: "Default Max Tokens", min: 100, max: 16000, step: 100 },
            { key: "requestTimeoutMs", label: "Request Timeout (ms)", min: 10000, max: 600000, step: 10000 },
            { key: "respondentsPerSegmentPerModel", label: "Respondents per Segment per Model", min: 1, max: 20, step: 1 },
            { key: "maxConcurrentApiCalls", label: "Max Concurrent API Calls", min: 1, max: 20, step: 1 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input
                type="number"
                className={inputClass}
                value={value?.[key] ?? ""}
                min={min}
                max={max}
                step={step}
                onChange={(e) => update(key, parseFloat(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-gray-300">Model Bias (Demo Data)</h3>
        <p className="text-xs text-gray-500 mb-2">Adjustment factors applied to demo data generation per model.</p>
        <div className="space-y-2">
          {Object.entries(value?.modelBias || {}).map(([model, bias]) => (
            <div key={model} className="flex items-center gap-3">
              <span className="text-sm flex-1">{model}</span>
              <input
                type="number"
                className={`${inputClass} w-32`}
                value={bias as number}
                step={0.05}
                onChange={(e) => {
                  update("modelBias", { ...value.modelBias, [model]: parseFloat(e.target.value) });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── JSON Editor (fallback for complex sections) ─────────────────────────

function JsonEditor({ value, onChange, label }: { value: unknown; onChange: (v: unknown) => void; label: string }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    try {
      const parsed = JSON.parse(newText);
      setParseError(null);
      onChange(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">{label} (JSON)</h3>
        {parseError && (
          <span className="text-xs text-red-400">{parseError}</span>
        )}
      </div>
      <textarea
        className={`${textareaClass} font-mono text-xs`}
        rows={30}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
