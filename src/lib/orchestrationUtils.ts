import { OrchestrationResult, ReplayStep } from '@/store/useChatStore';

const splitLines = (value: string) => value.split('\n');

const findLineNumbers = (lines: string[], matcher: (line: string) => boolean): number[] => {
  const found: number[] = [];
  lines.forEach((line, idx) => {
    if (matcher(line)) {
      found.push(idx + 1);
    }
  });
  return found;
};

const buildRefactoredOutput = (sourceCode: string): string => {
  const lines = splitLines(sourceCode);
  const hasMethodSignature = /\b(public|private|protected)\b/.test(sourceCode);

  if (!hasMethodSignature) {
    return [
      'public int optimizedMethod(int[] nums) {',
      '    int sum = 0;',
      '    for (int num : nums) {',
      '        sum += num;',
      '    }',
      '    return sum;',
      '}',
    ].join('\n');
  }

  const transformed = lines
    .map((line) => line.replace(/for\s*\(int\s+i\s*=\s*0;\s*i\s*<\s*([^;]+);\s*i\+\+\)/g, 'for (int num : $1)'))
    .map((line) => line.replace(/nums\[i\]/g, 'num'));

  if (!transformed.some((line) => line.includes('Set<'))) {
    const signatureIndex = transformed.findIndex((line) => line.includes('{'));
    if (signatureIndex >= 0) {
      transformed.splice(signatureIndex + 1, 0, '    Set<Integer> seen = new HashSet<>();');
    }
  }

  if (!transformed.some((line) => line.includes('seen.add'))) {
    const forLine = transformed.findIndex((line) => line.includes('for (int num :'));
    if (forLine >= 0) {
      transformed.splice(forLine + 1, 0, '        if (!seen.add(num)) {', '            return true;', '        }');
    }
  }

  return transformed.join('\n');
};

const buildReplaySteps = (sourceCode: string, refactoredOutput: string): ReplayStep[] => {
  const originalLines = splitLines(sourceCode);
  const refactoredLines = splitLines(refactoredOutput);

  const issueLines = findLineNumbers(originalLines, (line) => line.includes('for (') || line.includes('while ('));
  const addedLines = findLineNumbers(refactoredLines, (line) => line.includes('Set<') || line.includes('seen.add') || line.includes('for (int num :'));
  const removedLines = findLineNumbers(originalLines, (line) => line.includes('nums[i]') || line.includes('for (int i = 0'));

  return [
    {
      title: 'Pattern Detection',
      description: 'Detected loop and branching patterns in the original submission.',
      codeSnapshot: sourceCode,
      issueLines,
      addedLines: [],
      removedLines: [],
    },
    {
      title: 'Transformation Applied',
      description: 'Generated a simplified refactor candidate using set membership checks.',
      codeSnapshot: refactoredOutput,
      issueLines: [],
      addedLines,
      removedLines,
    },
  ];
};

export const generateMockOrchestrationResult = (sourceCode: string): OrchestrationResult => {
  const refactoredOutput = buildRefactoredOutput(sourceCode);
  const replaySteps = buildReplaySteps(sourceCode, refactoredOutput);

  const originalLines = splitLines(sourceCode).length;
  const refactoredLines = splitLines(refactoredOutput).length;

  return {
    replaySteps,
    metrics: [
      {
        title: 'Readability',
        before: `~${Math.max(1, Math.floor(originalLines / 3))}/10`,
        after: `~${Math.max(2, Math.floor(refactoredLines / 2))}/10`,
        direction: 'up',
        iconKey: 'Sparkles',
      },
      {
        title: 'Variables Managed',
        before: `${(sourceCode.match(/\bint\b/g) || []).length}`,
        after: `${(refactoredOutput.match(/\bint\b/g) || []).length}`,
        direction: 'down',
        iconKey: 'Layers',
      },
      {
        title: 'Cyclomatic Complexity',
        before: `${(sourceCode.match(/\bfor\s*\(/g) || []).length} loops`,
        after: `${(refactoredOutput.match(/\bfor\s*\(/g) || []).length} loops`,
        direction: 'neutral',
        iconKey: 'CheckCircle',
      },
    ],
    summary:
      'Generated mock orchestration data from the active source code. Replay and insights are now driven from session state and ready for WebSocket replacement.',
    diffHighlights: {
      added: replaySteps[1]?.addedLines ?? [],
      removed: replaySteps[1]?.removedLines ?? [],
    },
  };
};
