import { useEffect, useState, type CSSProperties } from "react";
import {
  authenticateAgent,
  disconnectAgent,
  getPlanModeState,
  getSessionPlan,
  getSessionSignals,
  listAccounts,
  newSession,
  sendPrompt,
  switchAccount,
} from "../../shared/api";
import { nextId, useAppStore } from "../../shared/store";
import type { AccountProfile, SessionMode } from "../../shared/types";

const MODE_CYCLE: SessionMode[] = ["ask", "auto", "plan", "yolo"];

function modeLabel(m: SessionMode): string {
  switch (m) {
    case "ask":
      return "Ask";
    case "auto":
      return "Auto";
    case "plan":
      return "Plan";
    case "yolo":
      return "Yolo";
  }
}

function modeColor(m: SessionMode): string {
  switch (m) {
    case "ask":
      return "var(--gb-ink-muted)";
    case "auto":
      return "var(--gb-accent)";
    case "plan":
      return "var(--gb-warning)";
    case "yolo":
      return "var(--gb-danger)";
  }
}

export function StatusBar() {
  const status = useAppStore((s) => s.status);
  const session = useAppStore((s) => s.session);
  const env = useAppStore((s) => s.env);
  const error = useAppStore((s) => s.error);
  const busy = useAppStore((s) => s.busy);
  const setStatus = useAppStore((s) => s.setStatus);
  const setSession = useAppStore((s) => s.setSession);
  const clearPermissions = useAppStore((s) => s.clearPermissions);
  const clearScroll = useAppStore((s) => s.clearScroll);
  const pushItem = useAppStore((s) => s.pushItem);
  const setError = useAppStore((s) => s.setError);
  const setView = useAppStore((s) => s.setView);
  const view = useAppStore((s) => s.view);
  const liveSessions = useAppStore((s) => s.liveSessions);
  const modelId = useAppStore((s) => s.modelId);
  const effort = useAppStore((s) => s.effort);
  const lastTokens = useAppStore((s) => s.lastTokens);
  const lastUsage = useAppStore((s) => s.lastUsage);
  const signals = useAppStore((s) => s.signals);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);
  const setContextOpen = useAppStore((s) => s.setContextOpen);
  const setModelsOpen = useAppStore((s) => s.setModelsOpen);
  const setSignals = useAppStore((s) => s.setSignals);
  const terminalsOpen = useAppStore((s) => s.terminalsOpen);
  const setTerminalsOpen = useAppStore((s) => s.setTerminalsOpen);
  const setHistoryOpen = useAppStore((s) => s.setHistoryOpen);
  const setExtensionsOpen = useAppStore((s) => s.setExtensionsOpen);
  const setAgentsOpen = useAppStore((s) => s.setAgentsOpen);
  const setAutomationOpen = useAppStore((s) => s.setAutomationOpen);
  const setMemoryOpen = useAppStore((s) => s.setMemoryOpen);
  const setAccountOpen = useAppStore((s) => s.setAccountOpen);
  const setAccountTab = useAppStore((s) => s.setAccountTab);
  const accountVault = useAppStore((s) => s.accountVault);
  const setAccountVault = useAppStore((s) => s.setAccountVault);
  const accountDropdownOpen = useAppStore((s) => s.accountDropdownOpen);
  const setAccountDropdownOpen = useAppStore((s) => s.setAccountDropdownOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const setProjectConfigOpen = useAppStore((s) => s.setProjectConfigOpen);
  const terminals = useAppStore((s) => s.terminals);
  const automationJobs = useAppStore((s) => s.automationJobs);
  const rewindTurns = useAppStore((s) => s.rewindTurns);
  const setBusy = useAppStore((s) => s.setBusy);
  const sessionMode = useAppStore((s) => s.sessionMode);
  const setSessionMode = useAppStore((s) => s.setSessionMode);
  const setPlanOpen = useAppStore((s) => s.setPlanOpen);
  const setPlanMarkdown = useAppStore((s) => s.setPlanMarkdown);
  const setPlanModeState = useAppStore((s) => s.setPlanModeState);
  const setAlwaysApprove = useAppStore((s) => s.setAlwaysApprove);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  useEffect(() => {
    void listAccounts()
      .then(setAccountVault)
      .catch(() => undefined);
  }, [setAccountVault]);

  const onQuickSwitch = async (id: string) => {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    try {
      await switchAccount(id);
      try {
        await authenticateAgent(env?.binaryPath ?? null);
      } catch {
        /* best-effort */
      }
      const v = await listAccounts();
      setAccountVault(v);
      const active = v.accounts.find((a) => a.id === id);
      const label = active?.label || active?.email || id;
      pushItem({
        id: nextId(),
        kind: "system",
        text: `Switched active account → ${label}`,
      });
      setAccountDropdownOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSwitchingAccount(false);
    }
  };

  const activeAccount = accountVault?.accounts?.find(
    (a: AccountProfile) => a.isActive || a.id === accountVault.activeAccountId,
  );

  const goHome = async () => {
    await disconnectAgent();
    setSession(null);
    setStatus("disconnected");
    clearPermissions();
    clearScroll();
    setView("welcome");
  };

  const onNew = async () => {
    try {
      clearScroll();
      clearPermissions();
      const s = await newSession();
      setSession(s);
      setStatus("ready");
      setView("chat");
      pushItem({
        id: nextId(),
        kind: "system",
        text: `New session · ${s.sessionId.slice(0, 8)}…`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const statusColor =
    status === "ready"
      ? "var(--gb-success)"
      : status === "connecting"
        ? "var(--gb-warning)"
        : status === "error"
          ? "var(--gb-danger)"
          : "var(--gb-ink-muted)";

  const used =
    signals?.contextTokensUsed ?? lastUsage?.totalTokens ?? lastTokens;
  const windowTok = signals?.contextWindowTokens ?? 0;
  const usagePct =
    signals?.usagePercent ??
    (windowTok > 0 && used != null ? (used / windowTok) * 100 : null);
  const turnHint =
    lastUsage &&
    (lastUsage.inputTokens != null || lastUsage.outputTokens != null)
      ? `Last turn · in ${lastUsage.inputTokens?.toLocaleString() ?? "—"} · out ${lastUsage.outputTokens?.toLocaleString() ?? "—"}${
          lastUsage.apiDurationMs != null
            ? ` · ${(lastUsage.apiDurationMs / 1000).toFixed(1)}s`
            : ""
        }`
      : null;

  const openContext = () => {
    setContextOpen(true);
    if (session?.sessionId) {
      void getSessionSignals(session.sessionId)
        .then(setSignals)
        .catch(() => undefined);
    }
  };

  const onCompact = async () => {
    if (!session || busy || status !== "ready") return;
    pushItem({
      id: nextId(),
      kind: "system",
      text: "Compacting context…",
    });
    try {
      setBusy(true);
      await sendPrompt("/compact");
      void getSessionSignals(session.sessionId)
        .then(setSignals)
        .catch(() => undefined);
      setContextOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onRewind = async () => {
    if (!session || busy || status !== "ready") return;
    const removed = rewindTurns(1);
    if (removed === 0) {
      setError("Nothing to rewind");
      return;
    }
    pushItem({
      id: nextId(),
      kind: "system",
      text: `Local scroll rewound (${removed} items). Asking agent to /rewind…`,
    });
    try {
      setBusy(true);
      await sendPrompt("/rewind");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const applyMode = async (next: SessionMode) => {
    if (!session || status !== "ready") return;
    const prev = sessionMode;
    setSessionMode(next);
    // Track yolo locally for reconnect defaults; agent slash owns live permission mode.
    if (next === "yolo") setAlwaysApprove(true);
    else if (prev === "yolo") setAlwaysApprove(false);

    const slash =
      next === "plan"
        ? "/plan"
        : next === "auto"
          ? "/auto"
          : next === "yolo"
            ? "/always-approve"
            : prev === "plan"
              ? "/plan"
              : prev === "auto"
                ? "/auto"
                : prev === "yolo"
                  ? "/always-approve"
                  : null;

    pushItem({
      id: nextId(),
      kind: "system",
      text: `Mode → ${modeLabel(next)}${slash ? ` (${slash})` : ""}`,
    });

    if (!slash) return;
    // Leaving plan via toggle: agent /plan toggles off when already pending/active.
    try {
      if (!busy) {
        setBusy(true);
        await sendPrompt(slash);
      } else {
        // Queue-free path: still try; agent may accept mode changes mid-turn for some modes.
        await sendPrompt(slash);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSessionMode(prev);
    } finally {
      setBusy(false);
    }
  };

  const cycleMode = () => {
    const idx = MODE_CYCLE.indexOf(sessionMode);
    const next = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
    void applyMode(next);
  };

  const openPlan = async () => {
    if (!session) return;
    setPlanOpen(true);
    try {
      const [md, mode] = await Promise.all([
        getSessionPlan(session.sessionId),
        getPlanModeState(session.sessionId),
      ]);
      setPlanMarkdown(md);
      setPlanModeState(mode);
      if (mode?.state && /active|pending/i.test(mode.state)) {
        setSessionMode("plan");
      }
    } catch {
      /* best-effort */
    }
  };

  const btn: CSSProperties = {
    borderRadius: 6,
    border: "1px solid var(--gb-border)",
    background: "var(--gb-surface-overlay)",
    color: "var(--gb-ink)",
    padding: "4px 8px",
    fontSize: 12,
    cursor: "pointer",
  };

  return (
    <header
      style={{
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--gb-border)",
        background: "var(--gb-surface-raised)",
        padding: "0 16px",
        color: "var(--gb-ink)",
        flexShrink: 0,
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Grok Build</span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--gb-ink-muted)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: statusColor,
              display: "inline-block",
            }}
          />
          {status}
          {busy ? " · working" : null}
        </span>
        {session || modelId ? (
          <button
            type="button"
            onClick={() => setModelsOpen(true)}
            title="Model & effort — click to change (/model, /effort)"
            style={{
              fontSize: 11,
              color: "var(--gb-accent)",
              fontFamily: "ui-monospace, Menlo, monospace",
              border: "1px solid var(--gb-border)",
              borderRadius: 6,
              background: "var(--gb-surface)",
              padding: "2px 8px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{modelId || "model"}</span>
            {effort ? (
              <span style={{ color: "var(--gb-ink-muted)", textTransform: "capitalize" }}>
                · {effort}
              </span>
            ) : null}
          </button>
        ) : null}
        {session ? (
          <button
            type="button"
            onClick={cycleMode}
            onContextMenu={(e) => {
              e.preventDefault();
              setAccountTab("safety");
              setAccountOpen(true);
            }}
            disabled={status !== "ready"}
            title="Cycle mode: Ask · Auto · Plan · Yolo. Right-click → permission three-way (Ask/Auto/Always)."
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: modeColor(sessionMode),
              fontFamily: "ui-monospace, Menlo, monospace",
              border: `1px solid ${modeColor(sessionMode)}`,
              borderRadius: 6,
              background: "var(--gb-surface)",
              padding: "2px 8px",
              cursor: status !== "ready" ? "not-allowed" : "pointer",
              opacity: status !== "ready" ? 0.5 : 1,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {modeLabel(sessionMode)}
          </button>
        ) : null}
        {used != null || usagePct != null ? (
          <button
            type="button"
            onClick={openContext}
            title={
              turnHint
                ? `${turnHint}\nClick for context panel (/context)`
                : "Context usage — click for details (/context)"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid var(--gb-border)",
              borderRadius: 6,
              background: "var(--gb-surface)",
              color: "var(--gb-ink-muted)",
              fontSize: 11,
              padding: "2px 8px",
              cursor: "pointer",
              fontFamily: "ui-monospace, Menlo, monospace",
            }}
          >
            {usagePct != null ? (
              <span
                style={{
                  width: 36,
                  height: 6,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${
                    usagePct >= 85
                      ? "var(--gb-danger)"
                      : usagePct >= 60
                        ? "var(--gb-warning)"
                        : "var(--gb-success)"
                  } ${Math.min(100, usagePct)}%, var(--gb-surface-overlay) ${Math.min(100, usagePct)}%)`,
                  display: "inline-block",
                }}
              />
            ) : null}
            {used != null ? `${used.toLocaleString()} tok` : ""}
            {usagePct != null ? ` ${usagePct.toFixed(0)}%` : ""}
          </button>
        ) : session ? (
          <button type="button" style={btn} onClick={openContext} title="Context / session info">
            Context
          </button>
        ) : null}
        {session ? (
          <span
            style={{
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 11,
              color: "var(--gb-ink-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 280,
            }}
            title={`${session.cwd}\n${session.sessionId}`}
          >
            {session.cwd}
          </span>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--gb-ink-muted)",
          flexShrink: 0,
        }}
      >
        {error ? (
          <span
            style={{
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "var(--gb-danger)",
            }}
            title={error}
          >
            {error}
          </span>
        ) : null}
        {env?.binaryVersion ? <span title="CLI version">{env.binaryVersion}</span> : null}
        {session || terminals.length > 0 || automationJobs.length > 0 ? (
          <button
            type="button"
            style={{
              ...btn,
              borderColor:
                terminals.some((t) => t.running) ||
                automationJobs.some((j) => j.status === "active")
                  ? "var(--gb-warning)"
                  : "var(--gb-border)",
              color:
                terminals.some((t) => t.running) ||
                automationJobs.some((j) => j.status === "active")
                  ? "var(--gb-warning)"
                  : "var(--gb-ink)",
            }}
            onClick={() => setAutomationOpen(true)}
            title="Automation hub — tasks, loops, goals, workflows (/tasks)"
          >
            Tasks
            {terminals.filter((t) => t.running).length +
              automationJobs.filter((j) => j.status === "active").length >
            0
              ? ` (${
                  terminals.filter((t) => t.running).length +
                  automationJobs.filter((j) => j.status === "active").length
                })`
              : ""}
          </button>
        ) : null}
        {session || terminals.length > 0 ? (
          <button
            type="button"
            style={{
              ...btn,
              borderColor: terminalsOpen ? "var(--gb-accent-dim)" : "var(--gb-border)",
              color: terminals.some((t) => t.running)
                ? "var(--gb-warning)"
                : "var(--gb-ink)",
            }}
            onClick={() => setTerminalsOpen(!terminalsOpen)}
            title="Agent terminals (/terminal)"
          >
            Term{terminals.length ? ` (${terminals.length})` : ""}
          </button>
        ) : null}
        <button
          type="button"
          style={btn}
          onClick={() => setProjectConfigOpen(true)}
          title="Project rules (AGENTS.md) & custom models (/rules, /custom-models)"
        >
          Rules
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => setHelpOpen(true)}
          title="Help & docs (/docs, /help)"
        >
          Help
        </button>
        <button type="button" style={btn} onClick={() => setShortcutsOpen(true)} title="Shortcuts (Ctrl+/)">
          ?
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => setExtensionsOpen(true)}
          title="Extensions hub — MCP, skills, plugins, hooks (/plugins)"
        >
          Extensions
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => setAgentsOpen(true)}
          title="Agents & personas (/agents, /personas)"
        >
          Agents
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => setMemoryOpen(true)}
          title="Memory & media — remember, browse, flush/dream, imagine (/memory)"
        >
          Memory
        </button>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            style={{
              ...btn,
              borderColor: accountDropdownOpen
                ? "var(--gb-accent)"
                : activeAccount
                  ? "var(--gb-border)"
                  : "var(--gb-warning)",
              color: activeAccount ? "var(--gb-ink)" : "var(--gb-warning)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
            onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
            title="1-Click Account Switcher & Profiles"
          >
            <span>👤</span>
            <span
              style={{
                maxWidth: 130,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 11,
              }}
            >
              {activeAccount?.label ||
                activeAccount?.email ||
                env?.authEmail ||
                "Account"}
            </span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
          </button>

          {accountDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 280,
                background: "var(--gb-surface-raised)",
                border: "1px solid var(--gb-border)",
                borderRadius: 8,
                boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
                zIndex: 9999,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "2px 6px",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--gb-ink-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Switch Account
                </span>
                <span style={{ fontSize: 11, color: "var(--gb-ink-muted)" }}>
                  {accountVault?.accounts?.length || 0} saved
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {accountVault?.accounts && accountVault.accounts.length > 0 ? (
                  accountVault.accounts.map((acc: AccountProfile) => {
                    const isActive =
                      acc.isActive || acc.id === accountVault.activeAccountId;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => void onQuickSwitch(acc.id)}
                        disabled={switchingAccount}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: isActive
                            ? "1px solid var(--gb-accent)"
                            : "1px solid var(--gb-border)",
                          background: isActive
                            ? "var(--gb-surface)"
                            : "transparent",
                          color: "var(--gb-ink)",
                          cursor: "pointer",
                          textAlign: "left",
                          gap: 6,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: isActive ? 600 : 400,
                              fontSize: 12,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {acc.label}
                          </div>
                          {acc.email && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "var(--gb-ink-muted)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {acc.email}
                            </div>
                          )}
                        </div>
                        {isActive ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--gb-accent)",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            ✓ Active
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--gb-accent)",
                              fontWeight: 500,
                              flexShrink: 0,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--gb-surface-overlay)",
                            }}
                          >
                            Switch
                          </span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--gb-ink-muted)",
                      padding: "8px 6px",
                      textAlign: "center",
                    }}
                  >
                    No saved accounts
                  </div>
                )}
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--gb-border)",
                  paddingTop: 6,
                  display: "flex",
                  gap: 6,
                }}
              >
                <button
                  type="button"
                  style={{ ...btn, flex: 1, fontSize: 11, textAlign: "center" }}
                  onClick={() => {
                    setAccountDropdownOpen(false);
                    setAccountTab("accounts");
                    setAccountOpen(true);
                  }}
                >
                  + Add / Manage Accounts…
                </button>
              </div>
            </div>
          )}
        </div>
        <button type="button" style={btn} onClick={() => setSettingsOpen(true)} title="Settings (Ctrl+,)">
          Settings
        </button>
        {(session || liveSessions.length > 0) && view !== "welcome" ? (
          <button
            type="button"
            style={btn}
            onClick={() => setView("dashboard")}
            title="Multi-agent dashboard"
          >
            Dashboard{liveSessions.length ? ` (${liveSessions.length})` : ""}
          </button>
        ) : null}
        {session ? (
          <>
            <button
              type="button"
              style={{
                ...btn,
                borderColor:
                  sessionMode === "plan" ? "var(--gb-warning)" : "var(--gb-border)",
                color: sessionMode === "plan" ? "var(--gb-warning)" : "var(--gb-ink)",
              }}
              onClick={() => void openPlan()}
              title="View / edit plan.md (/view-plan). Enter plan mode with /plan."
            >
              Plan
            </button>
            <button
              type="button"
              style={btn}
              disabled={busy || status !== "ready"}
              onClick={() => void onCompact()}
              title="Compress context (/compact)"
            >
              Compact
            </button>
            <button
              type="button"
              style={btn}
              disabled={busy || status !== "ready"}
              onClick={() => void onRewind()}
              title="Undo last turn (/rewind)"
            >
              Rewind
            </button>
            <button
              type="button"
              style={btn}
              onClick={() => setHistoryOpen(true)}
              title="Prompt history (/history)"
            >
              History
            </button>
            <button type="button" style={btn} onClick={() => void onNew()} title="New session">
              New
            </button>
            <button type="button" style={btn} onClick={() => void goHome()} title="Home">
              Home
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
