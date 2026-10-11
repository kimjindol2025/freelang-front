'use strict';

// 브라우저/FX 오류의 생성물 위치를 원본 Front 소스 위치로 변환한다.
// sourceMapLines가 있으면 정확한 줄 매핑을 우선하고, 구형 build state는
// 범위 sourceMap으로 하위 호환한다.

function resolveGeneratedLocation(line, column, sourceMapLines = {}, sourceMap = {}) {
  const generatedLine = Number(line) || 0;
  const generatedColumn = Number(column) || 0;
  if (generatedLine <= 0) return null;

  const exact = sourceMapLines[String(generatedLine)];
  if (exact && typeof exact.file === 'string') {
    return {
      file: exact.file,
      line: Number(exact.line) || 0,
      column: generatedColumn || Number(exact.column) || 0,
      generated: { file: '_app.fl', line: generatedLine, column: generatedColumn },
    };
  }

  for (const [range, file] of Object.entries(sourceMap || {})) {
    const [start, end] = range.split('-').map(Number);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (generatedLine >= start && generatedLine <= end) {
      return {
        file,
        line: generatedLine - start + 1,
        column: generatedColumn,
        generated: { file: '_app.fl', line: generatedLine, column: generatedColumn },
      };
    }
  }
  return null;
}

function extractGeneratedLocation(entry) {
  const source = String(entry?.source || '');
  const stack = String(entry?.stack || '');
  const candidates = [
    source.match(/(?:^|[/\\\s])_app\.fl(?::(\d+)(?::(\d+))?)/),
    stack.match(/(?:^|[/\\\s])_app\.fl(?::(\d+)(?::(\d+))?)/),
    stack.match(/\bat line (\d+)(?:, col(?:umn)?\s*(\d+))?/i),
  ];
  const match = candidates.find(Boolean);
  if (!match) return null;
  return { line: Number(match[1]) || 0, column: Number(match[2]) || 0 };
}

function extractSourceLocation(entry) {
  const source = String(entry?.source || '');
  const stack = String(entry?.stack || '');
  const pattern = /(?:^|[\s(/\\])((?:pages|components|src)\/[^\s):]+\.(?:flx|fl)):(\d+)(?::(\d+))?/;
  const match = source.match(pattern) || stack.match(pattern);
  if (!match) return null;
  return { file: match[1], line: Number(match[2]) || 0, column: Number(match[3]) || 0 };
}

function normalizeBrowserError(entry, state = {}) {
  const generatedLocation = extractGeneratedLocation(entry);
  const mapped = generatedLocation
    ? resolveGeneratedLocation(
      generatedLocation.line,
      generatedLocation.column,
      state.sourceMapLines,
      state.sourceMap,
    )
    : null;
  const direct = extractSourceLocation(entry);
  if (!mapped && !direct) return { ...entry };
  if (!mapped && direct) {
    return {
      ...entry,
      source: direct.file,
      line: direct.line,
      col: direct.column,
      source_location: {
        file: direct.file,
        line: direct.line,
        column: direct.column,
      },
      generated_location: null,
    };
  }
  return {
    ...entry,
    source: mapped.file,
    line: mapped.line,
    col: mapped.column,
    source_location: {
      file: mapped.file,
      line: mapped.line,
      column: mapped.column,
    },
    generated_location: mapped.generated,
  };
}

module.exports = {
  extractGeneratedLocation,
  extractSourceLocation,
  normalizeBrowserError,
  resolveGeneratedLocation,
};
