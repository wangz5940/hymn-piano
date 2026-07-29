import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Music2,
  Piano,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  crossRoadDemo,
  fingeringPrinciples,
  fingeringWorkflow,
} from "@/features/fingering/lessons";

export function FingeringPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="指法与手位"
        title="不是背几指，而是知道为什么这样按"
        description="这一页把指法文档里的核心思想变成正式训练模块：先判断调性、手位、音域和和弦，再决定指法。目标是让你拿到陌生诗歌也能自己推导。"
      />

      <section className="fingering-hero">
        <div>
          <p className="eyebrow">核心判断</p>
          <h2>手位先行，指法随后</h2>
          <p>
            钢琴真正训练的不是“这个音用几指”，而是“这一句手放在哪里、何时移动、为什么移动”。
            所以平台后续每首诗歌都要存手位、指法、和弦和原因。
          </p>
        </div>
        <div className="fingering-hero__stack" aria-label="手位和指法关系">
          <span>调性</span>
          <ArrowRight size={18} aria-hidden="true" />
          <span>手位</span>
          <ArrowRight size={18} aria-hidden="true" />
          <span>指法</span>
          <ArrowRight size={18} aria-hidden="true" />
          <span>下一句</span>
        </div>
      </section>

      <section className="fingering-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">五条原则</p>
            <h2>从文档进入课程的规则</h2>
          </div>
          <BookOpenText size={22} aria-hidden="true" />
        </div>
        <div className="principle-grid">
          {fingeringPrinciples.map((principle, index) => (
            <article className="principle-card" key={principle.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{principle.title}</h3>
              <p>{principle.rule}</p>
              <dl>
                <div>
                  <dt>为什么</dt>
                  <dd>{principle.reason}</dd>
                </div>
                <div>
                  <dt>怎么练</dt>
                  <dd>{principle.practice}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="paper-panel fingering-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">五步分析法</p>
            <h2>拿到陌生简谱时的固定动作</h2>
          </div>
          <Target size={22} aria-hidden="true" />
        </div>
        <div className="workflow-rail">
          {fingeringWorkflow.map((step, index) => (
            <article key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.question}</p>
              <strong>{step.output}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="fingering-demo">
        <header className="fingering-demo__header">
          <div>
            <p className="eyebrow">示范课</p>
            <h2>{crossRoadDemo.title}</h2>
            <p>{crossRoadDemo.purpose}</p>
          </div>
          <span className="status-badge status-badge--green">
            {crossRoadDemo.key_signature}
          </span>
        </header>

        <div className="position-map">
          <div className="section-heading">
            <div>
              <p className="eyebrow">右手 D 大调手位</p>
              <h3>音级、音名、手指、理由</h3>
            </div>
            <Piano size={21} aria-hidden="true" />
          </div>
          <div className="position-map__grid">
            {crossRoadDemo.right_hand_position.map((note) => (
              <article key={note.jianpu}>
                <strong>{note.jianpu}</strong>
                <span>{note.note}</span>
                <b>{note.finger}</b>
                <p>{note.reason}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="fingering-demo__split">
          <section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">左手和弦</p>
                <h3>看到和弦名，手直接成形</h3>
              </div>
              <Music2 size={21} aria-hidden="true" />
            </div>
            <div className="left-chord-list">
              {crossRoadDemo.left_hand_chords.map((chord) => (
                <article key={chord.symbol}>
                  <span>{chord.symbol}</span>
                  <strong>{chord.notes}</strong>
                  <b>{chord.fingering}</b>
                  <p>{chord.reason}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">乐句指法</p>
                <h3>每一句都解释为什么</h3>
              </div>
              <CheckCircle2 size={21} aria-hidden="true" />
            </div>
            <div className="phrase-plan-list">
              {crossRoadDemo.phrases.map((phrase) => (
                <article key={phrase.phrase}>
                  <p className="phrase-plan-list__phrase">{phrase.phrase}</p>
                  <dl>
                    <div>
                      <dt>和弦</dt>
                      <dd>{phrase.chord}</dd>
                    </div>
                    <div>
                      <dt>右手</dt>
                      <dd>{phrase.right_hand}</dd>
                    </div>
                    <div>
                      <dt>左手</dt>
                      <dd>{phrase.left_hand}</dd>
                    </div>
                    <div>
                      <dt>理由</dt>
                      <dd>{phrase.reason}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="transfer-card">
          <p className="eyebrow">迁移规则</p>
          <h3>以后遇到类似诗歌，照这个顺序自己推导</h3>
          <ul>
            {crossRoadDemo.transfer_rule.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </section>
    </div>
  );
}
