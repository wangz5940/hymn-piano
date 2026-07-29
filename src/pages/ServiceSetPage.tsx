import {
  ArrowDown,
  ArrowUp,
  Download,
  FileUp,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ServiceSimulation } from "@/components/ServiceSimulation";
import { hymnCatalog } from "@/data/hymns.generated";
import { serviceSetStorage } from "@/features/progress/storage";
import { useAppStore } from "@/store/useAppStore";

export function ServiceSetPage() {
  const serviceSet = useAppStore((state) => state.service_set);
  const updateMeta = useAppStore((state) => state.updateServiceSetMeta);
  const updateItem = useAppStore((state) => state.updateServiceItem);
  const moveItem = useAppStore((state) => state.moveServiceItem);
  const removeItem = useAppStore((state) => state.removeServiceItem);
  const replaceServiceSet = useAppStore((state) => state.replaceServiceSet);
  const [isSimulating, setIsSimulating] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hymnsByKey = useMemo(
    () => new Map(hymnCatalog.map((hymn) => [hymn.key, hymn])),
    [],
  );
  const validHymnKeys = useMemo(
    () => new Set(hymnCatalog.map((hymn) => hymn.key)),
    [],
  );
  const items = [...serviceSet.items].sort(
    (left, right) => left.position - right.position,
  );

  const exportSet = () => {
    const blob = new Blob([serviceSetStorage.export(serviceSet)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `诗琴-服侍曲单-${date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importSet = async (file: File) => {
    try {
      const serialized = await file.text();
      replaceServiceSet(
        serviceSetStorage.import(serialized, validHymnKeys),
      );
      setImportError("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "曲单文件无法读取",
      );
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="服侍预备"
        title="把每一次换歌，也提前练过"
        description="曲单不只是顺序。记录每首歌的调、速度、起拍和衔接，聚会现场才能把注意力留给领诗者与会众。"
        actions={
          <div className="header-button-row">
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importSet(file);
                event.currentTarget.value = "";
              }}
            />
            <button
              className="button button--secondary"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp size={17} aria-hidden="true" />
              导入
            </button>
            <button className="button button--secondary" type="button" onClick={exportSet}>
              <Download size={17} aria-hidden="true" />
              导出
            </button>
          </div>
        }
      />

      {importError && (
        <div className="inline-error inline-error--block" role="alert">
          {importError}
        </div>
      )}

      <section className="service-set-meta paper-panel">
        <label>
          曲单名称
          <input
            value={serviceSet.title}
            maxLength={80}
            onChange={(event) => updateMeta({ title: event.target.value })}
          />
        </label>
        <label>
          聚会日期
          <input
            type="date"
            value={serviceSet.scheduled_for ?? ""}
            onChange={(event) =>
              updateMeta({ scheduled_for: event.target.value || undefined })
            }
          />
        </label>
        <div>
          <span>当前曲目</span>
          <strong>{items.length} 首</strong>
        </div>
        <button
          className="button button--primary"
          type="button"
          disabled={items.length === 0}
          onClick={() => setIsSimulating(true)}
        >
          <Play size={17} aria-hidden="true" />
          开始聚会模拟
        </button>
      </section>

      {items.length > 0 ? (
        <section className="service-list">
          {items.map((item, index) => {
            const hymn = hymnsByKey.get(item.hymn_key);
            if (!hymn) return null;
            return (
              <article key={item.id} className="service-item">
                <div className="service-item__order">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <button
                      className="icon-button icon-button--tiny"
                      type="button"
                      aria-label={`上移第 ${hymn.key} 首`}
                      disabled={index === 0}
                      onClick={() => moveItem(item.id, -1)}
                    >
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-button icon-button--tiny"
                      type="button"
                      aria-label={`下移第 ${hymn.key} 首`}
                      disabled={index === items.length - 1}
                      onClick={() => moveItem(item.id, 1)}
                    >
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="service-item__title">
                  <span className="hymn-number-chip">{hymn.key}</span>
                  <div>
                    <h2>{hymn.title}</h2>
                    <Link to={`/practice/${hymn.key}`}>打开歌谱练习</Link>
                  </div>
                </div>
                <div className="service-item__fields">
                  <label>
                    调
                    <select
                      value={item.practice_key}
                      onChange={(event) =>
                        updateItem(item.id, {
                          practice_key: event.target.value,
                        })
                      }
                    >
                      {["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"].map(
                        (key) => (
                          <option key={key}>{key}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    BPM
                    <input
                      type="number"
                      min="40"
                      max="160"
                      value={item.bpm}
                      onChange={(event) =>
                        updateItem(item.id, {
                          bpm: Math.min(
                            160,
                            Math.max(40, Number(event.target.value)),
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    起拍
                    <input
                      value={item.count_in}
                      maxLength={40}
                      onChange={(event) =>
                        updateItem(item.id, {
                          count_in: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="service-item__transition">
                    衔接备注
                    <input
                      value={item.transition_note}
                      maxLength={200}
                      placeholder="例如：末句渐慢，四拍后进入下一首"
                      onChange={(event) =>
                        updateItem(item.id, {
                          transition_note: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <button
                  className="icon-button icon-button--danger"
                  type="button"
                  aria-label={`从曲单移除第 ${hymn.key} 首`}
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="empty-state empty-state--large">
          <Plus size={34} aria-hidden="true" />
          <h2>曲单还是空的</h2>
          <p>从诗歌曲库加入 3—5 首歌，再回来记录调性和入口。</p>
          <Link className="button button--primary" to="/hymns">
            去曲库选诗歌
          </Link>
        </section>
      )}

      {isSimulating && items.length > 0 && (
        <ServiceSimulation
          items={items}
          hymnsByKey={hymnsByKey}
          onClose={() => setIsSimulating(false)}
        />
      )}
    </div>
  );
}
