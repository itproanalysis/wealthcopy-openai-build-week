import type { WealthReport } from "@/lib/wealth/wealth-report";
import { buildEnglishJudgeBrief } from "@/lib/wealth/report-presentation";

export type WealthJudgePanelProps = Readonly<{
  report: WealthReport;
}>;

export function WealthJudgePanel({ report }: WealthJudgePanelProps) {
  const brief = buildEnglishJudgeBrief(report);

  return (
    <section className="wc-judge-panel" aria-labelledby="wc-judge-title" lang="en">
      <header className="wc-judge-header">
        <p className="wc-judge-eyebrow">ENGLISH JUDGE MODE</p>
        <h2 className="wc-judge-title" id="wc-judge-title" tabIndex={-1}>{brief.heading}</h2>
        <p className="wc-judge-introduction">{brief.introduction}</p>
      </header>

      <div className="wc-judge-level" aria-label={`Wealth band path: ${brief.level.path}`}>
        <div className="wc-judge-level-node">
          <span>Current band</span>
          <strong>{brief.level.current.id}</strong>
          <small>{brief.level.current.label}</small>
        </div>
        {brief.level.terminal ? (
          <p className="wc-judge-level-terminal">Terminal operating band</p>
        ) : (
          <>
            <span className="wc-judge-level-arrow" aria-hidden="true">→</span>
            <div className="wc-judge-level-node wc-judge-level-target">
              <span>Next band</span>
              <strong>{brief.level.target.id}</strong>
              <small>{brief.level.target.label}</small>
            </div>
          </>
        )}
      </div>

      <dl className="wc-judge-metrics">
        <div className="wc-judge-metric">
          <dt>{brief.thresholdGap.label}</dt>
          <dd>
            <strong>{brief.thresholdGap.value}</strong>
            <span>{brief.thresholdGap.explanation}</span>
          </dd>
        </div>
        <div className="wc-judge-metric">
          <dt>{brief.inBandPosition.label}</dt>
          <dd>
            <strong>{brief.inBandPosition.value}</strong>
            <span>{brief.inBandPosition.explanation}</span>
          </dd>
        </div>
        <div className="wc-judge-metric">
          <dt>Largest composition difference</dt>
          <dd>
            <strong>{brief.dominantGap.label}</strong>
            <span>{brief.dominantGap.explanation}</span>
          </dd>
        </div>
      </dl>

      <section className="wc-judge-section" aria-labelledby="wc-judge-lenses-title">
        <header className="wc-judge-section-head">
          <p>THREE REVIEW LENSES</p>
          <h3 id="wc-judge-lenses-title">What the household should review</h3>
        </header>
        <ol className="wc-judge-lenses">
          {brief.reviewLenses.map((lens, index) => (
            <li className={`wc-judge-lens wc-judge-lens-${lens.tone}`} key={lens.id}>
              <span className="wc-judge-lens-index">0{index + 1}</span>
              <div>
                <h4>{lens.title}</h4>
                <strong>{lens.status}</strong>
                <p>{lens.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="wc-judge-assurance">
        <section className={`wc-judge-safety wc-judge-safety-${brief.safety.status}`} aria-labelledby="wc-judge-safety-title">
          <p>SAFETY FIRST</p>
          <h3 id="wc-judge-safety-title">{brief.safety.headline}</h3>
          <span>{brief.safety.detail}</span>
        </section>
        <section className={`wc-judge-confidence wc-judge-confidence-${brief.dataConfidence.grade}`} aria-labelledby="wc-judge-confidence-title">
          <p>DATA CONFIDENCE</p>
          <h3 id="wc-judge-confidence-title">{brief.dataConfidence.label}</h3>
          <span>{brief.dataConfidence.detail}</span>
        </section>
      </div>

      <section className="wc-judge-ai" aria-labelledby="wc-judge-ai-title">
        <header className="wc-judge-section-head">
          <p>BOUNDED AI ORCHESTRATION</p>
          <h3 id="wc-judge-ai-title">{brief.gptPlan.title}</h3>
          <span>{brief.gptPlan.summary}</span>
        </header>
        <dl className="wc-judge-plan">
          {brief.gptPlan.selections.map((selection) => (
            <div className="wc-judge-plan-item" key={selection.role}>
              <dt>{selection.role}</dt>
              <dd>
                <span>{selection.label}</span>
                <code>{selection.id}</code>
              </dd>
            </div>
          ))}
        </dl>
        <p className="wc-judge-ai-boundary">{brief.gptPlan.boundary}</p>
      </section>

      <footer className="wc-judge-policy" aria-label="Method and limitations">
        <p>{brief.policy.reference}</p>
        <p>{brief.policy.limitation}</p>
        <p>{brief.policy.threshold}</p>
      </footer>
    </section>
  );
}
