import { useCallback, useEffect, useRef, useState } from "react";
import LetterheadExchangeForm from "./LetterheadExchangeForm";
import LetterheadExchangeHistory from "./LetterheadExchangeHistory";
import LetterheadExchangeManageDialog from "./LetterheadExchangeManageDialog";
import {
  fetchLetterheadExchangeFormOptions,
  getSafeLetterheadExchangeError,
  listLetterheadExchanges,
} from "./letterheadExchangeService";

export default function BodLetterheadExchangePanel() {
  const [optionsState, setOptionsState] = useState({ status: "idle", members: [], events: [], error: "" });
  const [historyState, setHistoryState] = useState({ status: "idle", exchanges: [], error: "" });
  const [managingId, setManagingId] = useState("");
  const versionRef = useRef(0);

  const loadOptions = useCallback(async () => {
    const version = ++versionRef.current;
    setOptionsState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const options = await fetchLetterheadExchangeFormOptions();
      if (version !== versionRef.current) return;
      setOptionsState({ status: "success", members: options.members, events: options.events, error: "" });
    } catch (error) {
      if (version !== versionRef.current) return;
      setOptionsState((current) => ({
        ...current,
        status: "error",
        error: getSafeLetterheadExchangeError(error, "Unable to load Letterhead Exchange options."),
      }));
    }
  }, []);

  const loadHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setHistoryState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const payload = await listLetterheadExchanges();
      setHistoryState({ status: "success", exchanges: payload.exchanges, error: "" });
    } catch (error) {
      if (silent) return;
      setHistoryState((current) => ({
        ...current,
        status: "error",
        error: getSafeLetterheadExchangeError(error, "Unable to load previous Letterhead Exchanges."),
      }));
    }
  }, []);

  useEffect(() => {
    loadOptions();
    loadHistory();
  }, [loadHistory, loadOptions]);

  async function handleSaved() {
    await loadHistory();
  }

  // Manage dialog changes: apply the returned record right away, then refresh quietly so the
  // open dialog is never unmounted by a loading state.
  async function handleManagedChange(updated) {
    if (updated?.id) {
      setHistoryState((current) => ({
        ...current,
        exchanges: current.exchanges.map((item) => (item.id === updated.id ? updated : item)),
      }));
    }
    await loadHistory({ silent: true });
  }

  const managedExchange = managingId ? historyState.exchanges.find((item) => item.id === managingId) || null : null;

  return (
    <section className="bod-letterhead-exchanges" aria-labelledby="bod-letterhead-exchanges-title">
      <div className="bod-letterhead-exchanges__heading">
        <div>
          <p className="bod-tools-kicker">Club records</p>
          <h2 id="bod-letterhead-exchanges-title">Letterhead Exchanges</h2>
          <p>Record official letterhead exchanges with members of other Rotaract clubs.</p>
        </div>
        <span>Backend authorized</span>
      </div>

      {optionsState.status === "loading" ? <p className="letterhead-muted">Loading members and conducted events...</p> : null}
      {optionsState.status === "error" ? (
        <div className="letterhead-inline-error" role="alert">
          <p>{optionsState.error}</p>
          <button type="button" onClick={loadOptions}>Retry options</button>
        </div>
      ) : null}
      {optionsState.status === "success" && !optionsState.members.length ? (
        <p className="letterhead-muted">No eligible RCPH representatives are available right now.</p>
      ) : null}

      <div className="bod-letterhead-exchanges__layout">
        <LetterheadExchangeForm
          members={optionsState.members}
          events={optionsState.events}
          optionsStatus={optionsState.status}
          onSaved={handleSaved}
        />
        <LetterheadExchangeHistory
          status={historyState.status}
          error={historyState.error}
          exchanges={historyState.exchanges}
          onRetry={loadHistory}
          onManage={(exchange) => setManagingId(exchange.id)}
        />
      </div>

      {managedExchange ? (
        <LetterheadExchangeManageDialog
          key={managedExchange.id}
          exchange={managedExchange}
          members={optionsState.members}
          events={optionsState.events}
          optionsStatus={optionsState.status}
          onClose={() => setManagingId("")}
          onChanged={handleManagedChange}
        />
      ) : null}
    </section>
  );
}
