//! Dictionary replacements and deterministic text passes (spoken emails, pause ellipses).
//! Shared by speech-to-text (vocabulary prompt) and polish (replacements).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

pub(crate) const VOCABULARY_CAP: usize = 800;

pub(crate) fn is_word(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// Simple one-to-one lower casing, the same idea as a case-insensitive regex match.
pub(crate) fn lc(c: char) -> char {
    c.to_lowercase().next().unwrap_or(c)
}

// ---------------------------------------------------------------------------------------------
// Dictionary
// ---------------------------------------------------------------------------------------------

pub(crate) struct Rule {
    from: Vec<char>,
    to: String,
}

/// Replacements and vocabulary from a Python Scribe `dictionary.json`.
///
/// Replacement rule (same as Python Scribe):
/// - A phrase matches only as a whole word run: the character before it and the character
///   after it must not be a letter, digit or underscore.
/// - Matching ignores case. The replacement text is written exactly as stored, so
///   `"btw" -> "by the way"` also turns `Btw` into `by the way`.
/// - The longest phrase wins when phrases overlap. One pass runs left to right, and the
///   output of a rule is never matched again. An identity entry therefore shields a phrase
///   from a shorter rule.
/// - After the phrase rules, spoken emails (`name at site.com`) are joined and Whisper pause
///   ellipses are removed.
#[derive(Default)]
pub struct Dictionary {
    pub replacements: Vec<(String, String)>,
    pub vocabulary: Vec<String>,
    rules: Vec<Rule>,
}

impl Dictionary {
    pub fn new(replacements: Vec<(String, String)>, vocabulary: Vec<String>) -> Self {
        // A later entry replaces an earlier one with the same lower-case key.
        let mut by_key: HashMap<String, usize> = HashMap::new();
        let mut rules: Vec<Rule> = Vec::new();
        for (from, to) in &replacements {
            let chars: Vec<char> = from.chars().map(lc).collect();
            if chars.is_empty() {
                continue;
            }
            let key: String = chars.iter().collect();
            match by_key.get(&key) {
                Some(&at) => rules[at].to = to.clone(),
                None => {
                    by_key.insert(key, rules.len());
                    rules.push(Rule {
                        from: chars,
                        to: to.clone(),
                    });
                }
            }
        }
        rules.sort_by_key(|r| std::cmp::Reverse(r.from.len()));
        Self {
            replacements,
            vocabulary,
            rules,
        }
    }

    /// A missing or bad file gives an empty dictionary. This never panics.
    pub fn load(path: &Path) -> Self {
        let Ok(text) = std::fs::read_to_string(path) else {
            return Self::default();
        };
        let Ok(data) = serde_json::from_str::<serde_json::Value>(&text) else {
            return Self::default();
        };
        let replacements = data["replacements"]
            .as_object()
            .map(|map| {
                map.iter()
                    .filter_map(|(k, v)| Some((k.clone(), v.as_str()?.to_owned())))
                    .collect()
            })
            .unwrap_or_default();
        let vocabulary = data["vocabulary"]
            .as_array()
            .map(|list| {
                list.iter()
                    .filter_map(|v| v.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default();
        Self::new(replacements, vocabulary)
    }

    /// Phrase rules, then email joining, then ellipsis cleanup.
    pub fn apply(&self, text: &str) -> String {
        if text.is_empty() {
            return String::new();
        }
        let replaced = self.replace_phrases(text);
        normalize_pause_ellipses(&stitch_emails(&replaced))
    }

    fn replace_phrases(&self, text: &str) -> String {
        if self.rules.is_empty() {
            return text.to_owned();
        }
        let chars: Vec<char> = text.chars().collect();
        let mut out = String::with_capacity(text.len());
        let mut i = 0;
        while i < chars.len() {
            if i == 0 || !is_word(chars[i - 1]) {
                let first = lc(chars[i]);
                let hit = self.rules.iter().find(|rule| {
                    let end = i + rule.from.len();
                    rule.from[0] == first
                        && end <= chars.len()
                        && chars[i..end]
                            .iter()
                            .zip(&rule.from)
                            .all(|(a, b)| lc(*a) == *b)
                        && chars.get(end).is_none_or(|c| !is_word(*c))
                });
                if let Some(rule) = hit {
                    out.push_str(&rule.to);
                    i += rule.from.len();
                    continue;
                }
            }
            out.push(chars[i]);
            i += 1;
        }
        out
    }

    /// Comma-separated vocabulary for the Whisper prompt. Never a sentence.
    /// Case-insensitive dedupe, and the list stops before it passes 800 characters
    /// (each term counts its length plus 2).
    pub fn vocabulary_prompt(&self) -> String {
        let mut seen: HashSet<String> = HashSet::from(["vocabulary".to_owned()]);
        let mut terms: Vec<&str> = Vec::new();
        let mut length = 0;
        for term in &self.vocabulary {
            let term = term.trim();
            if term.is_empty() || term.contains(',') || seen.contains(&term.to_lowercase()) {
                continue;
            }
            length += term.chars().count() + 2;
            if length > VOCABULARY_CAP {
                break;
            }
            seen.insert(term.to_lowercase());
            terms.push(term);
        }
        terms.join(", ")
    }
}

/// One shared dictionary. It checks the file time on each use and reloads only on a change.
pub struct SharedDictionary {
    path: PathBuf,
    state: Mutex<(Option<SystemTime>, Arc<Dictionary>)>,
}

impl SharedDictionary {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            state: Mutex::new((None, Arc::new(Dictionary::default()))),
        }
    }

    /// The current dictionary. The lock is held only for the file stat and a reload.
    pub fn current(&self) -> Arc<Dictionary> {
        let mtime = std::fs::metadata(&self.path)
            .and_then(|m| m.modified())
            .ok();
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if state.0 != mtime {
            // The time is stored even when the file is bad, so a bad file is not parsed again.
            *state = (mtime, Arc::new(Dictionary::load(&self.path)));
        }
        state.1.clone()
    }
}

// ---------------------------------------------------------------------------------------------
// Deterministic text cleanup (ported from Python Scribe, without a regex crate)
// ---------------------------------------------------------------------------------------------

/// Non-space runs as (start, end) char ranges.
pub(crate) fn spans(chars: &[char]) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    let mut start = None;
    for (i, c) in chars.iter().enumerate() {
        match (c.is_whitespace(), start) {
            (false, None) => start = Some(i),
            (true, Some(s)) => {
                out.push((s, i));
                start = None;
            }
            _ => {}
        }
    }
    if let Some(s) = start {
        out.push((s, chars.len()));
    }
    out
}

pub(crate) fn local_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || "._%+-".contains(c)
}

pub(crate) fn domain_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '.' || c == '-'
}

/// Start of the local part that ends at `end`: the longest run of local characters, moved
/// forward to its first word character (a word boundary is needed there).
pub(crate) fn local_start(chars: &[char], span_start: usize, end: usize) -> Option<usize> {
    let mut start = end;
    while start > span_start && local_char(chars[start - 1]) {
        start -= 1;
    }
    while start < end && !is_word(chars[start]) {
        start += 1;
    }
    let boundary = start == span_start || !is_word(chars[start - 1]);
    (start < end && boundary).then_some(start)
}

pub(crate) type Match = (usize, String, usize);

/// Replace every match of `matcher` (from char index, replacement, to char index).
pub(crate) fn rewrite(
    text: &str,
    matcher: impl Fn(&[char], &[(usize, usize)], usize) -> Option<Match>,
) -> String {
    let chars: Vec<char> = text.chars().collect();
    let spans = spans(&chars);
    let mut out = String::with_capacity(text.len());
    let mut cursor = 0;
    let mut i = 0;
    while i + 2 < spans.len() {
        if let Some((from, replacement, to)) = matcher(&chars, &spans, i) {
            if from >= cursor {
                out.extend(&chars[cursor..from]);
                out.push_str(&replacement);
                cursor = to;
                i += 3;
                continue;
            }
        }
        i += 1;
    }
    out.extend(&chars[cursor..]);
    out
}

pub(crate) fn span_is(chars: &[char], span: (usize, usize), words: &[&str]) -> bool {
    let word: String = chars[span.0..span.1].iter().collect();
    words.iter().any(|w| word.eq_ignore_ascii_case(w))
}

/// `name at site.com` and `name @ site.com` become `name@site.com`.
/// `name@site dot com` becomes `name@site.com`.
pub(crate) fn stitch_emails(text: &str) -> String {
    let lower = text.to_ascii_lowercase();
    if !(lower.contains(" at ") || lower.contains(" @ ") || lower.contains(" dot ")) {
        return text.to_owned();
    }
    let joined = rewrite(text, |chars, spans, i| {
        let (s, e) = spans[i];
        let start = local_start(chars, s, e)?;
        if !span_is(chars, spans[i + 1], &["at", "@"]) {
            return None;
        }
        let (ds, de) = spans[i + 2];
        let run = chars[ds..de]
            .iter()
            .take_while(|c| domain_char(**c))
            .count();
        let end = (3..=run).rev().find(|&end| {
            let letters = chars[ds..ds + end]
                .iter()
                .rev()
                .take_while(|c| c.is_ascii_alphabetic())
                .count();
            letters >= 2
                && end > letters + 1
                && chars[ds + end - letters - 1] == '.'
                && (ds + end >= de || !is_word(chars[ds + end]))
        })?;
        let local: String = chars[start..e].iter().collect();
        let domain: String = chars[ds..ds + end].iter().collect();
        Some((start, format!("{local}@{domain}"), ds + end))
    });
    rewrite(&joined, |chars, spans, i| {
        let (s, e) = spans[i];
        let at = (s..e).rev().find(|&k| chars[k] == '@')?;
        if at + 1 >= e || !chars[at + 1..e].iter().all(|c| domain_char(*c)) {
            return None;
        }
        let start = local_start(chars, s, at)?;
        if !span_is(chars, spans[i + 1], &["dot"]) {
            return None;
        }
        let (ds, de) = spans[i + 2];
        let letters = chars[ds..de]
            .iter()
            .take_while(|c| c.is_ascii_alphabetic())
            .count();
        if letters < 2 || (ds + letters < de && is_word(chars[ds + letters])) {
            return None;
        }
        let head: String = chars[start..e].iter().collect();
        let tld: String = chars[ds..ds + letters].iter().collect();
        Some((start, format!("{head}.{tld}"), ds + letters))
    })
}

/// One pass of ellipsis cleanup. `rule` gets the text after the ellipsis and returns
/// (chars to consume, replacement) when it applies. The ellipsis must follow a word character.
pub(crate) fn ellipsis_pass(
    text: &str,
    rule: impl Fn(&[char]) -> Option<(usize, &'static str)>,
) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        let run = match chars[i] {
            '\u{2026}' => 1,
            '.' => chars[i..].iter().take_while(|c| **c == '.').count(),
            _ => 0,
        };
        let is_ellipsis = run >= 3 || chars[i] == '\u{2026}';
        if is_ellipsis && i > 0 && is_word(chars[i - 1]) {
            if let Some((consumed, replacement)) = rule(&chars[i + run..]) {
                out.push_str(replacement);
                i += run + consumed;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

pub(crate) fn blanks(rest: &[char]) -> usize {
    rest.iter()
        .take_while(|c| **c == ' ' || **c == '\t')
        .count()
}

/// Drop Whisper's mid-sentence pause ellipses. Rules run in this order:
/// before punctuation (removed), at line end (becomes a period),
/// before a word (becomes a space), before spaces (becomes one space).
pub(crate) fn normalize_pause_ellipses(text: &str) -> String {
    if !text.contains("...") && !text.contains('\u{2026}') {
        return text.to_owned();
    }
    let step = ellipsis_pass(text, |rest| {
        let n = blanks(rest);
        rest.get(n)
            .is_some_and(|c| ",;:!?-".contains(*c))
            .then_some((n, ""))
    });
    let step = ellipsis_pass(&step, |rest| {
        let n = blanks(rest);
        let at_end = |k: usize| rest.get(k).is_none_or(|c| *c == '\n');
        (at_end(n) || (rest.get(n) == Some(&'\r') && at_end(n + 1))).then_some((n, "."))
    });
    let step = ellipsis_pass(&step, |rest| {
        rest.first()
            .is_some_and(|c| is_word(*c))
            .then_some((0, " "))
    });
    ellipsis_pass(&step, |rest| {
        let n = blanks(rest);
        (n > 0).then_some((n, " "))
    })
}
