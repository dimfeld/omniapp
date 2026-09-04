export type RegexFlag = "d" | "g" | "i" | "m" | "s" | "u" | "v" | "y";

export type RegexCaptureGroup = {
  index: number;
  value: string | null;
};

export type RegexNamedCaptureGroup = {
  name: string;
  value: string | null;
};

export type RegexMatch = {
  full: string;
  index: number;
  groups: RegexCaptureGroup[];
  namedGroups: RegexNamedCaptureGroup[];
};

export type RegexTestResult =
  | { valid: true; matches: RegexMatch[] }
  | { valid: false; error: string; matches: [] };

export function testRegex(pattern: string, text: string, flags: string): RegexTestResult {
  let expression: RegExp;
  try {
    expression = new RegExp(pattern, flags);
  } catch (cause) {
    return {
      valid: false,
      error: cause instanceof Error ? cause.message : "That regular expression is not valid.",
      matches: [],
    };
  }

  const matches: RegexMatch[] = [];
  const addMatch = (match: RegExpExecArray) => {
    matches.push({
      full: match[0],
      index: match.index,
      groups: match.slice(1).map((value, index) => ({ index: index + 1, value: value ?? null })),
      namedGroups: Object.entries(match.groups ?? {}).map(([name, value]) => ({
        name,
        value: value ?? null,
      })),
    });
  };

  if (!expression.global) {
    const match = expression.exec(text);
    if (match) addMatch(match);
    return { valid: true, matches };
  }

  while (true) {
    const match = expression.exec(text);
    if (!match) break;
    addMatch(match);
    if (match[0] === "") {
      expression.lastIndex = advanceStringIndex(text, expression.lastIndex, expression.unicode);
    }
  }

  return { valid: true, matches };
}

function advanceStringIndex(text: string, index: number, unicode: boolean) {
  if (!unicode || index + 1 >= text.length) return index + 1;
  const first = text.charCodeAt(index);
  const second = text.charCodeAt(index + 1);
  const isSurrogatePair =
    first >= 0xd800 && first <= 0xdbff && second >= 0xdc00 && second <= 0xdfff;
  return index + (isSurrogatePair ? 2 : 1);
}
