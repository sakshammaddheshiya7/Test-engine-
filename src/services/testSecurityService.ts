export type TestSecurityCounters = {
  tabSwitches: number;
  copyAttempts: number;
  contextMenuOpens: number;
};

export type TestSecuritySnapshot = TestSecurityCounters & {
  suspiciousScore: number;
  suspicious: boolean;
  notes: string[];
};

type SecurityInput = {
  counters: TestSecurityCounters;
  totalQuestions: number;
  elapsedSec: number;
};

export function evaluateTestSecurity(input: SecurityInput): TestSecuritySnapshot {
  const { counters, totalQuestions, elapsedSec } = input;
  const safeQuestions = Math.max(1, totalQuestions);
  const avgSecPerQuestion = elapsedSec > 0 ? elapsedSec / safeQuestions : 0;

  let suspiciousScore = counters.tabSwitches * 3 + counters.copyAttempts * 4 + counters.contextMenuOpens * 2;
  const notes: string[] = [];

  if (counters.tabSwitches >= 2) {
    notes.push("frequent_tab_switching");
  }
  if (counters.copyAttempts >= 1) {
    notes.push("copy_attempt_detected");
  }
  if (avgSecPerQuestion > 0 && avgSecPerQuestion < 10) {
    suspiciousScore += 2;
    notes.push("unusually_fast_solving_pattern");
  }

  return {
    ...counters,
    suspiciousScore,
    suspicious: suspiciousScore >= 6,
    notes,
  };
}

export function shouldShowBreakReminder(elapsedSec: number) {
  return elapsedSec >= 45 * 60;
}
