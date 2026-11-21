import { FormEvent, useEffect, useMemo, useState } from "react";
import { isDemoMode, quoteApi, resetDemoWorkspace } from "./api";
import {
  FollowUpInput,
  Overview,
  Quote,
  QuoteInput,
  QuoteStage,
  followUpTypes,
  quoteStages
} from "./types";

const stageLabel: Record<QuoteStage, string> = {
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost"
};

const stageProbability: Record<QuoteStage, number> = {
  discovery: 20,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

const futureDate = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

const formatDate = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : dateFormat.format(date);
};

const initials = (value: string) =>
  value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

type Notice = { tone: "success" | "error" | "info"; text: string };

const emptyMetrics: Overview["metrics"] = {
  activeQuotes: 0,
  pipelineValue: 0,
  weightedValue: 0,
  wonValue: 0,
  atRiskCount: 0
};

function App() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [activeStage, setActiveStage] = useState<QuoteStage | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const refreshWorkspace = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [nextQuotes, nextOverview] = await Promise.all([quoteApi.listQuotes(), quoteApi.getOverview()]);
      setQuotes(nextQuotes);
      setOverview(nextOverview);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "QuoteFlow could not reach the API."
      });
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshWorkspace();
  }, []);

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return quotes.filter((quote) => {
      const matchesStage = activeStage === "all" || quote.stage === activeStage;
      const matchesSearch =
        !query ||
        [quote.client, quote.contact, quote.service, quote.number, ...quote.tags]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);
      return matchesStage && matchesSearch;
    });
  }, [activeStage, quotes, search]);

  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId) ?? null;
  const metrics = overview?.metrics ?? emptyMetrics;
  const pipeline =
    overview?.pipeline ?? quoteStages.map((stage) => ({ stage, count: 0, value: 0 }));
  const maximumPipelineCount = Math.max(...pipeline.map((item) => item.count), 1);

  const createQuote = async (input: QuoteInput) => {
    setIsBusy(true);
    try {
      const quote = await quoteApi.createQuote(input);
      await refreshWorkspace(false);
      setComposerOpen(false);
      setSelectedQuoteId(quote.id);
      setNotice({ tone: "success", text: `${quote.number} was added to the pipeline.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Quote could not be created." });
    } finally {
      setIsBusy(false);
    }
  };

  const moveQuote = async (id: string, stage: QuoteStage) => {
    setIsBusy(true);
    try {
      const quote = await quoteApi.updateQuote(id, {
        stage,
        probability: stageProbability[stage]
      });
      await refreshWorkspace(false);
      setNotice({ tone: "success", text: `${quote.client} is now in ${stageLabel[stage]}.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Stage could not be updated." });
    } finally {
      setIsBusy(false);
    }
  };

  const scheduleFollowUp = async (id: string, input: FollowUpInput) => {
    setIsBusy(true);
    try {
      const quote = await quoteApi.addFollowUp(id, input);
      await refreshWorkspace(false);
      setNotice({ tone: "success", text: `Follow-up scheduled for ${quote.client}.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Follow-up could not be scheduled." });
    } finally {
      setIsBusy(false);
    }
  };

  const restoreDemo = async () => {
    resetDemoWorkspace();
    setSelectedQuoteId(null);
    setActiveStage("all");
    setSearch("");
    await refreshWorkspace();
    setNotice({ tone: "info", text: "The browser demo was restored to its sample workspace." });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#workspace" aria-label="QuoteFlow workspace">
          <span className="brand-mark">QF</span>
          <span>
            <strong>QuoteFlow</strong>
            <small>pipeline workspace</small>
          </span>
        </a>
        <div className="topbar-actions">
          <span className="demo-indicator"><i /> {isDemoMode ? "Browser demo" : "API workspace"}</span>
          <button className="button button-quiet" onClick={() => void refreshWorkspace()} disabled={isLoading}>
            Refresh
          </button>
          <button className="button button-primary" onClick={() => setComposerOpen(true)}>
            New quote <span aria-hidden="true">+</span>
          </button>
        </div>
      </header>

      <main id="workspace">
        {isDemoMode && (
          <aside className="demo-banner" aria-label="Interactive demo information">
            <span>
              <strong>Interactive portfolio demo</strong>
              Sample companies are fictional. Your changes stay only in this browser; no production backend is connected.
            </span>
            <button className="text-button" onClick={() => void restoreDemo()} disabled={isLoading || isBusy}>
              Restore sample data
            </button>
          </aside>
        )}
        <section className="hero">
          <div>
            <p className="eyebrow">Commercial momentum, made visible</p>
            <h1>A clearer path from first conversation to signed work.</h1>
            <p className="hero-copy">
              Keep the value, the decision-maker and the next move together. QuoteFlow turns a scattered sales
              process into a focused daily workspace.
            </p>
          </div>
          <div className="hero-note">
            <span className="hero-note-label">Today&apos;s focus</span>
            <strong>{metrics.atRiskCount || "No"} at-risk {metrics.atRiskCount === 1 ? "quote" : "quotes"}</strong>
            <span>Review the next action before it becomes a delay.</span>
          </div>
        </section>

        {notice && (
          <div className={`notice notice-${notice.tone}`} role="status">
            <span>{notice.text}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button>
          </div>
        )}

        <section className="metrics-grid" aria-label="Pipeline metrics">
          <MetricCard label="Active pipeline" value={money.format(metrics.pipelineValue)} detail={`${metrics.activeQuotes} open quotes`} accent="blue" />
          <MetricCard label="Weighted outlook" value={money.format(metrics.weightedValue)} detail="Based on current probability" accent="violet" />
          <MetricCard label="Won this cycle" value={money.format(metrics.wonValue)} detail="Ready for delivery kickoff" accent="green" />
          <MetricCard label="Needs attention" value={String(metrics.atRiskCount).padStart(2, "0")} detail="Close date is approaching" accent="amber" />
        </section>

        <section className="pipeline-overview" aria-label="Pipeline distribution">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Pipeline pulse</p>
              <h2>Where the work is moving</h2>
            </div>
            <span>{metrics.activeQuotes} active opportunities</span>
          </div>
          <div className="stage-distribution">
            {pipeline.map((item) => (
              <button
                className={`stage-summary ${activeStage === item.stage ? "is-active" : ""}`}
                key={item.stage}
                onClick={() => setActiveStage(item.stage)}
                aria-pressed={activeStage === item.stage}
              >
                <span className={`stage-dot stage-${item.stage}`} />
                <span className="stage-summary-main">
                  <span>{stageLabel[item.stage]}</span>
                  <strong>{item.count}</strong>
                </span>
                <span className="stage-track"><i style={{ width: `${(item.count / maximumPipelineCount) * 100}%` }} /></span>
                <small>{money.format(item.value)}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace-grid">
          <div className="pipeline-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Pipeline</p>
                <h2>Quotes in motion</h2>
              </div>
              <span>{filteredQuotes.length} visible</span>
            </div>

            <div className="filters">
              <div className="stage-tabs" aria-label="Filter quotes by stage">
                <button className={activeStage === "all" ? "is-active" : ""} onClick={() => setActiveStage("all")}>All</button>
                {quoteStages.slice(0, 3).map((stage) => (
                  <button
                    className={activeStage === stage ? "is-active" : ""}
                    key={stage}
                    onClick={() => setActiveStage(stage)}
                  >
                    {stageLabel[stage]}
                  </button>
                ))}
              </div>
              <label className="search-box">
                <span className="sr-only">Search pipeline</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client or service" />
              </label>
            </div>

            <div className="quote-list" aria-live="polite">
              <div className="quote-list-head" aria-hidden="true">
                <span>Client &amp; solution</span>
                <span>Value</span>
                <span>Close</span>
                <span>Stage</span>
              </div>
              {isLoading ? (
                <LoadingRows />
              ) : filteredQuotes.length ? (
                filteredQuotes.map((quote) => (
                  <button
                    className={`quote-row ${selectedQuoteId === quote.id ? "is-selected" : ""}`}
                    key={quote.id}
                    onClick={() => setSelectedQuoteId(quote.id)}
                  >
                    <span className="quote-client">
                      <span className="avatar">{initials(quote.client)}</span>
                      <span>
                        <strong>{quote.client}</strong>
                        <small>{quote.service}</small>
                      </span>
                    </span>
                    <span className="quote-value">
                      <strong>{money.format(quote.amount)}</strong>
                      <small>{quote.probability}% likely</small>
                    </span>
                    <span className={`quote-date ${quote.health === "at-risk" ? "is-risk" : ""}`}>
                      {formatDate(quote.expectedCloseDate)}
                    </span>
                    <span><StagePill stage={quote.stage} /></span>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <strong>No quotes match that view.</strong>
                  <span>Try another stage or clear the search.</span>
                </div>
              )}
            </div>
          </div>

          <aside className="activity-panel">
            <div className="side-card risk-card">
              <div className="side-card-head">
                <div>
                  <p className="eyebrow">Decision radar</p>
                  <h2>Needs attention</h2>
                </div>
                <span className="count-badge">{overview?.atRisk.length ?? 0}</span>
              </div>
              {overview?.atRisk.length ? (
                <div className="risk-list">
                  {overview.atRisk.map((quote) => (
                    <button className="risk-row" key={quote.id} onClick={() => setSelectedQuoteId(quote.id)}>
                      <span className="risk-client">
                        <strong>{quote.client}</strong>
                        <small>{quote.nextAction}</small>
                      </span>
                      <span>{formatDate(quote.expectedCloseDate)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="side-empty">No close dates need intervention right now.</p>
              )}
            </div>

            <div className="side-card activity-card">
              <div className="side-card-head">
                <div>
                  <p className="eyebrow">Next moves</p>
                  <h2>Planned follow-ups</h2>
                </div>
                <button className="text-button" onClick={() => setComposerOpen(true)}>Add quote</button>
              </div>
              <div className="follow-up-list">
                {overview?.upcomingFollowUps.length ? (
                  overview.upcomingFollowUps.map((item) => (
                    <button className="follow-up-row" key={item.followUp.id} onClick={() => setSelectedQuoteId(item.quoteId)}>
                      <span className={`follow-up-icon type-${item.followUp.type}`}>{item.followUp.type[0].toUpperCase()}</span>
                      <span>
                        <strong>{item.client}</strong>
                        <small>{item.followUp.note}</small>
                      </span>
                      <time>{formatDate(item.followUp.dueDate)}</time>
                    </button>
                  ))
                ) : (
                  <p className="side-empty">Follow-ups will appear here as the team schedules them.</p>
                )}
              </div>
            </div>
          </aside>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          QuoteFlow · Developed by <strong>Mohamed Ajmal</strong> — A curious developer working with real time projects
        </p>
      </footer>

      {composerOpen && (
        <QuoteComposer
          busy={isBusy}
          onClose={() => setComposerOpen(false)}
          onSubmit={createQuote}
        />
      )}

      {selectedQuote && (
        <QuoteDetail
          key={selectedQuote.id}
          quote={selectedQuote}
          busy={isBusy}
          onClose={() => setSelectedQuoteId(null)}
          onMove={moveQuote}
          onSchedule={scheduleFollowUp}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function StagePill({ stage }: { stage: QuoteStage }) {
  return <span className={`stage-pill stage-${stage}`}>{stageLabel[stage]}</span>;
}

function LoadingRows() {
  return (
    <div className="loading-rows" aria-label="Loading pipeline">
      {[0, 1, 2, 3].map((item) => <span className="loading-row" key={item} />)}
    </div>
  );
}

function QuoteComposer({
  busy,
  onClose,
  onSubmit
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: QuoteInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Omit<QuoteInput, "tags"> & { tags: string }>({
    client: "",
    contact: "",
    owner: "Mohamed Ajmal",
    service: "",
    amount: 5000,
    stage: "discovery",
    probability: 20,
    expectedCloseDate: futureDate(14),
    nextAction: "Schedule a scope review with the client.",
    tags: "web, workflow"
  });

  const updateStage = (stage: QuoteStage) => {
    setDraft((value) => ({ ...value, stage, probability: stageProbability[stage] }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      ...draft,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">New opportunity</p>
            <h2 id="composer-title">Start a quote with a clear next step.</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close new quote form">×</button>
        </div>
        <form className="quote-form" onSubmit={submit}>
          <label>
            Client
            <input required value={draft.client} onChange={(event) => setDraft((value) => ({ ...value, client: event.target.value }))} placeholder="Company or account" />
          </label>
          <label>
            Main contact
            <input required value={draft.contact} onChange={(event) => setDraft((value) => ({ ...value, contact: event.target.value }))} placeholder="Name of decision-maker" />
          </label>
          <label>
            Proposed service
            <input required value={draft.service} onChange={(event) => setDraft((value) => ({ ...value, service: event.target.value }))} placeholder="What will be delivered?" />
          </label>
          <label>
            Quote value (USD)
            <input required min="1" type="number" value={draft.amount} onChange={(event) => setDraft((value) => ({ ...value, amount: Number(event.target.value) }))} />
          </label>
          <label>
            Pipeline stage
            <select value={draft.stage} onChange={(event) => updateStage(event.target.value as QuoteStage)}>
              {quoteStages.slice(0, 3).map((stage) => <option key={stage} value={stage}>{stageLabel[stage]}</option>)}
            </select>
          </label>
          <label>
            Probability
            <div className="range-field">
              <input min="0" max="100" type="range" value={draft.probability} onChange={(event) => setDraft((value) => ({ ...value, probability: Number(event.target.value) }))} />
              <span>{draft.probability}%</span>
            </div>
          </label>
          <label>
            Expected close
            <input required type="date" value={draft.expectedCloseDate} onChange={(event) => setDraft((value) => ({ ...value, expectedCloseDate: event.target.value }))} />
          </label>
          <label>
            Tags
            <input value={draft.tags} onChange={(event) => setDraft((value) => ({ ...value, tags: event.target.value }))} placeholder="web, API, priority" />
          </label>
          <label className="full-width">
            Next action
            <textarea required value={draft.nextAction} onChange={(event) => setDraft((value) => ({ ...value, nextAction: event.target.value }))} rows={3} />
          </label>
          <div className="form-actions full-width">
            <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Add to pipeline"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function QuoteDetail({
  quote,
  busy,
  onClose,
  onMove,
  onSchedule
}: {
  quote: Quote;
  busy: boolean;
  onClose: () => void;
  onMove: (id: string, stage: QuoteStage) => Promise<void>;
  onSchedule: (id: string, input: FollowUpInput) => Promise<void>;
}) {
  const [stage, setStage] = useState<QuoteStage>(quote.stage);
  const [followUp, setFollowUp] = useState<FollowUpInput>({
    type: "call",
    dueDate: futureDate(2),
    note: quote.nextAction
  });

  const schedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSchedule(quote.id, followUp);
  };

  return (
    <div className="drawer-backdrop" role="presentation">
      <aside className="quote-drawer" role="dialog" aria-modal="true" aria-labelledby="quote-title">
        <div className="drawer-head">
          <div className="drawer-client">
            <span className="avatar avatar-large">{initials(quote.client)}</span>
            <span>
              <small>{quote.number}</small>
              <h2 id="quote-title">{quote.client}</h2>
            </span>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close quote details">×</button>
        </div>

        <div className="drawer-overview">
          <StagePill stage={quote.stage} />
          <strong>{money.format(quote.amount)}</strong>
          <span>{quote.probability}% confidence · closes {formatDate(quote.expectedCloseDate)}</span>
        </div>

        <section className="drawer-section">
          <span className="field-label">Proposed solution</span>
          <p>{quote.service}</p>
          <div className="tag-list">{quote.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </section>

        <section className="drawer-section">
          <span className="field-label">Move through the pipeline</span>
          <div className="move-form">
            <select value={stage} onChange={(event) => setStage(event.target.value as QuoteStage)}>
              {quoteStages.map((item) => <option key={item} value={item}>{stageLabel[item]}</option>)}
            </select>
            <button className="button button-dark" disabled={busy || stage === quote.stage} onClick={() => void onMove(quote.id, stage)}>
              {busy ? "Updating…" : "Update stage"}
            </button>
          </div>
        </section>

        <section className="drawer-section action-section">
          <span className="field-label">Current next action</span>
          <p>{quote.nextAction}</p>
          <small>Owner: {quote.owner} · Contact: {quote.contact}</small>
        </section>

        <section className="drawer-section followup-form-wrap">
          <span className="field-label">Plan a follow-up</span>
          <form onSubmit={schedule}>
            <div className="form-pair">
              <label>
                Type
                <select value={followUp.type} onChange={(event) => setFollowUp((value) => ({ ...value, type: event.target.value as FollowUpInput["type"] }))}>
                  {followUpTypes.map((type) => <option key={type} value={type}>{type.replace("-", " ")}</option>)}
                </select>
              </label>
              <label>
                Due
                <input required type="date" value={followUp.dueDate} onChange={(event) => setFollowUp((value) => ({ ...value, dueDate: event.target.value }))} />
              </label>
            </div>
            <label>
              Note
              <textarea required rows={3} value={followUp.note} onChange={(event) => setFollowUp((value) => ({ ...value, note: event.target.value }))} />
            </label>
            <button className="button button-primary full-button" disabled={busy} type="submit">
              {busy ? "Scheduling…" : "Schedule follow-up"}
            </button>
          </form>
        </section>

        <section className="drawer-section history-section">
          <span className="field-label">Upcoming activity</span>
          {quote.followUps.length ? (
            <ul>
              {quote.followUps.slice().sort((left, right) => left.dueDate.localeCompare(right.dueDate)).map((item) => (
                <li key={item.id}>
                  <span>{formatDate(item.dueDate)}</span>
                  <p>{item.note}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">No follow-ups scheduled yet.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

export default App;
