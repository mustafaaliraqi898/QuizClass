import type { SqliteLiveSessionRepository } from './liveSessionRepository.ts';

export class LiveSessionPhaseEngine {
  private repository: SqliteLiveSessionRepository;
  private onPhaseTransitioned: (sessionId: string) => Promise<void>;
  private timers = new Map<string, NodeJS.Timeout>();
  private closed = false;

  constructor(
    repository: SqliteLiveSessionRepository,
    onPhaseTransitioned: (sessionId: string) => Promise<void>
  ) {
    this.repository = repository;
    this.onPhaseTransitioned = onPhaseTransitioned;
  }

  clearTimer(sessionId: string): void {
    const existing = this.timers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(sessionId);
    }
  }

  clearAll(): void {
    this.closed = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  scheduleSession(sessionId: string): void {
    if (this.closed) return;
    this.clearTimer(sessionId);

    let runningStates;
    try {
      runningStates = this.repository.listRunningSessionStatesForRecovery();
    } catch {
      return;
    }

    const current = runningStates.find((s) => s.id === sessionId);
    if (!current) return;

    if (current.currentPhase === 'question_results' && current.advanceMode === 'manual') {
      return;
    }

    if (!current.phaseEndsAt) return;
    const endsAtMs = Date.parse(current.phaseEndsAt);
    if (!Number.isFinite(endsAtMs)) return;

    const delayMs = Math.min(Math.max(0, endsAtMs - Date.now()), 2147483647);

    const expectedPhase = current.currentPhase;
    const expectedIndex = current.currentQuestionIndex;

    const timer = setTimeout(() => {
      this.timers.delete(sessionId);
      if (this.closed) return;
      void this.executeTransition(sessionId, expectedPhase, expectedIndex);
    }, delayMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    this.timers.set(sessionId, timer);
  }

  private async executeTransition(
    sessionId: string,
    expectedPhase: string,
    expectedIndex: number
  ): Promise<void> {
    if (this.closed) return;

    try {
      let transitioned = false;

      if (expectedPhase === 'question_intro') {
        transitioned = this.repository.beginAnsweringPhase(sessionId, expectedIndex);
      } else if (expectedPhase === 'answering') {
        transitioned = this.repository.finalizeCurrentQuestion(sessionId, expectedIndex);
      } else if (expectedPhase === 'question_results') {
        const res = this.repository.advanceFromResults(sessionId, expectedIndex);
        transitioned = res.transitioned;
      }

      if (transitioned && !this.closed) {
        await this.onPhaseTransitioned(sessionId);
        this.scheduleSession(sessionId);
      }
    } catch {
      // Ignore errors if database was closed during shutdown
    }
  }

  recoverActiveSessionsOnBoot(): void {
    if (this.closed) return;

    let runningSessions;
    try {
      runningSessions = this.repository.listRunningSessionStatesForRecovery();
    } catch {
      return;
    }

    const nowMs = Date.now();
    for (const session of runningSessions) {
      if (session.currentPhase === 'question_results' && session.advanceMode === 'manual') {
        continue;
      }

      const endsAtMs = session.phaseEndsAt ? Date.parse(session.phaseEndsAt) : NaN;
      if (Number.isFinite(endsAtMs) && endsAtMs <= nowMs) {
        if (session.currentPhase === 'question_intro') {
          this.repository.beginAnsweringPhase(session.id, session.currentQuestionIndex);
          this.scheduleSession(session.id);
        } else if (session.currentPhase === 'answering') {
          this.repository.finalizeCurrentQuestion(session.id, session.currentQuestionIndex);
          this.scheduleSession(session.id);
        } else if (
          session.currentPhase === 'question_results' &&
          session.advanceMode === 'auto'
        ) {
          const res = this.repository.advanceFromResults(
            session.id,
            session.currentQuestionIndex
          );
          if (!res.completed) {
            this.scheduleSession(session.id);
          }
        }
      } else {
        this.scheduleSession(session.id);
      }
    }
  }
}
