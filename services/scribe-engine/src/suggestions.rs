//! v1.2 dictionary suggestions, mined from history.
//!
//! A suggestion is a run of 1 to 3 raw words that polish replaced with the same 1 to 3
//! words in at least `MIN_COUNT` dictations. Case and punctuation changes do not count.
//! A word run already in the dictionary, or rejected once, is never suggested.

use crate::config::write_atomic;
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const MIN_COUNT: u32 = 2;
pub const MAX_ITEMS: usize = 50;
const MAX_RUN: usize = 3;
/// Longer dictations are skipped: the word alignment is quadratic.
const MAX_WORDS: usize = 400;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Suggestion {
    pub wrong: String,
    pub correct: String,
    pub count: u32,
}

/// Words without edge punctuation. Inner `'`, `-` and `.` stay (`don't`, `e-mail`, `v1.2`).
fn words(text: &str) -> Vec<&str> {
    text.split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()))
        .filter(|w| !w.is_empty())
        .collect()
}

/// The replaced runs between `raw` and `cleaned`, as (wrong in lower case, correct as written).
fn replacements(raw: &str, cleaned: &str) -> Vec<(String, String)> {
    let a = words(raw);
    let b = words(cleaned);
    if a.len() > MAX_WORDS || b.len() > MAX_WORDS {
        return Vec::new();
    }
    let la: Vec<String> = a.iter().map(|w| w.to_lowercase()).collect();
    let lb: Vec<String> = b.iter().map(|w| w.to_lowercase()).collect();
    // lcs[i][j]: longest common run of la[i..] and lb[j..].
    let mut lcs = vec![vec![0u16; lb.len() + 1]; la.len() + 1];
    for i in (0..la.len()).rev() {
        for j in (0..lb.len()).rev() {
            lcs[i][j] = if la[i] == lb[j] {
                lcs[i + 1][j + 1] + 1
            } else {
                lcs[i + 1][j].max(lcs[i][j + 1])
            };
        }
    }
    let mut out = Vec::new();
    let (mut i, mut j) = (0, 0);
    let (mut from_i, mut from_j) = (0, 0);
    let mut flush = |i: usize, j: usize, from_i: usize, from_j: usize| {
        let (removed, added) = (i - from_i, j - from_j);
        if (1..=MAX_RUN).contains(&removed) && (1..=MAX_RUN).contains(&added) {
            out.push((la[from_i..i].join(" "), b[from_j..j].join(" ")));
        }
    };
    while i < la.len() || j < lb.len() {
        if i < la.len() && j < lb.len() && la[i] == lb[j] {
            flush(i, j, from_i, from_j);
            i += 1;
            j += 1;
            (from_i, from_j) = (i, j);
        } else if j < lb.len() && (i == la.len() || lcs[i][j + 1] >= lcs[i + 1][j]) {
            j += 1;
        } else {
            i += 1;
        }
    }
    flush(i, j, from_i, from_j);
    out
}

/// Suggestions from (raw, cleaned) pairs. `known` is true for a lower-case wrong run that
/// is already a dictionary key or was rejected.
pub fn mine<'a>(
    pairs: impl IntoIterator<Item = (&'a str, &'a str)>,
    known: impl Fn(&str) -> bool,
) -> Vec<Suggestion> {
    let mut counts: HashMap<(String, String), u32> = HashMap::new();
    for (raw, cleaned) in pairs {
        let mut seen = BTreeSet::new();
        for pair in replacements(raw, cleaned) {
            if seen.insert(pair.clone()) {
                *counts.entry(pair).or_default() += 1;
            }
        }
    }
    let mut items: Vec<Suggestion> = counts
        .into_iter()
        .filter(|((wrong, _), count)| *count >= MIN_COUNT && !known(wrong))
        .map(|((wrong, correct), count)| Suggestion {
            wrong,
            correct,
            count,
        })
        .collect();
    items.sort_by(|a, b| {
        b.count
            .cmp(&a.count)
            .then_with(|| a.wrong.cmp(&b.wrong))
            .then_with(|| a.correct.cmp(&b.correct))
    });
    items.truncate(MAX_ITEMS);
    items
}

/// Rejected wrong runs, in lower case. File: a JSON array of strings.
pub struct Rejects {
    path: PathBuf,
    set: Mutex<BTreeSet<String>>,
}

impl Rejects {
    /// A missing or bad file gives an empty list.
    pub fn open(path: &Path) -> Self {
        let set = std::fs::read_to_string(path)
            .ok()
            .and_then(|text| serde_json::from_str::<BTreeSet<String>>(&text).ok())
            .unwrap_or_default();
        Self {
            path: path.to_path_buf(),
            set: Mutex::new(set),
        }
    }

    pub fn contains(&self, wrong: &str) -> bool {
        self.set
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .contains(&wrong.to_lowercase())
    }

    pub fn add(&self, wrong: &str) -> Result<(), String> {
        let mut set = self.set.lock().unwrap_or_else(|e| e.into_inner());
        let mut next = set.clone();
        next.insert(wrong.to_lowercase());
        let bytes = serde_json::to_vec_pretty(&next).map_err(|e| e.to_string())?;
        write_atomic(&self.path, &bytes).map_err(|e| e.to_string())?;
        *set = next;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(wrong: &str, correct: &str, count: u32) -> Suggestion {
        Suggestion {
            wrong: wrong.into(),
            correct: correct.into(),
            count,
        }
    }

    #[test]
    fn a_fix_seen_twice_is_suggested_with_its_count() {
        let pairs = [
            ("i talked to jersey today", "I talked to Gersi today."),
            ("jersey said hi", "Gersi said hi."),
            ("call jersey and leo nightness", "Call Gersi and Leonidas."),
            ("leo nightness is ready", "Leonidas is ready."),
            ("the weather is nice", "The weather is nice."),
        ];
        assert_eq!(
            mine(pairs, |_| false),
            [s("jersey", "Gersi", 3), s("leo nightness", "Leonidas", 2)]
        );
    }

    #[test]
    fn one_time_case_punctuation_long_and_known_changes_are_not_suggested() {
        let pairs = [
            ("send it to bob", "Send it to Rob."),
            ("hello, world", "Hello world!"),
            ("hello, world", "Hello world!"),
            ("we should go there now", "Let us leave for that place now."),
            ("we should go there now", "Let us leave for that place now."),
            ("btw it works", "By the way, it works."),
            ("btw it works", "By the way, it works."),
        ];
        assert_eq!(mine(pairs, |wrong| wrong == "btw"), []);
    }

    #[test]
    fn a_fix_counts_once_per_dictation() {
        let pairs = [("jersey and jersey", "Gersi and Gersi")];
        assert_eq!(mine(pairs, |_| false), []);
    }

    #[test]
    fn rejects_persist_in_lower_case() {
        let dir = std::env::temp_dir().join(format!("scribe rejects {}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join("suggestions-rejected.json");
        let rejects = Rejects::open(&path);
        assert!(!rejects.contains("jersey"));
        rejects.add("Jersey").unwrap();
        assert!(rejects.contains("jersey"));
        assert!(Rejects::open(&path).contains("JERSEY"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
