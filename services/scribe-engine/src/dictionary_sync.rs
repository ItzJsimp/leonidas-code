//! Word sync between computers: the merge rules, with no file or network code.
//! Every word is one entry that carries the time of its last change. A deleted word stays as
//! an entry marked `gone`, so the deletion also reaches the other computer.
//! Built-in words are not in `Dictionary::body()`, so they never enter a sync state.

use crate::contract::{DictionaryBody, Replacement};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Entry {
    /// The spelling the user typed (`wrong` for a replacement, the term for vocabulary).
    pub name: String,
    /// The replacement text. Empty for a vocabulary term.
    pub correct: String,
    /// True when the user deleted the word.
    pub gone: bool,
    /// Milliseconds since the Unix epoch.
    pub at: u64,
}

/// Key `r:<wrong>` or `v:<term>`, lower case like the engine's own match rule.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SyncState(pub BTreeMap<String, Entry>);

fn replacement_key(wrong: &str) -> String {
    format!("r:{}", wrong.to_lowercase())
}

fn term_key(term: &str) -> String {
    format!("v:{}", term.to_lowercase())
}

/// Newest change wins. On a tie a deletion wins, then the larger text, so every computer
/// picks the same entry whatever order it merges in.
fn rank(e: &Entry) -> (u64, bool, &str, &str) {
    (e.at, e.gone, &e.name, &e.correct)
}

/// Union of two states. Commutative, associative and idempotent.
pub fn merge(a: &SyncState, b: &SyncState) -> SyncState {
    let mut out = a.0.clone();
    for (key, theirs) in &b.0 {
        match out.get(key) {
            Some(mine) if rank(mine) >= rank(theirs) => {}
            _ => {
                out.insert(key.clone(), theirs.clone());
            }
        }
    }
    SyncState(out)
}

/// The state after a save. A word that is new or changed gets `now`, a word that is gone from
/// the body becomes a deletion at `now`, and a word that did not change keeps its old time.
/// `now` never goes below an older time on the same word, so a local edit always wins locally.
pub fn record(prev: &SyncState, body: &DictionaryBody, now: u64) -> SyncState {
    // A later entry with the same key replaces an earlier one, like `Dictionary::new`.
    let mut current: BTreeMap<String, (&str, &str)> = BTreeMap::new();
    for r in &body.replacements {
        if !r.wrong.is_empty() {
            current.insert(replacement_key(&r.wrong), (&r.wrong, &r.correct));
        }
    }
    for term in &body.vocabulary {
        current.insert(term_key(term), (term, ""));
    }
    let mut out = prev.0.clone();
    for (key, (name, correct)) in &current {
        let unchanged = prev
            .0
            .get(key)
            .is_some_and(|e| !e.gone && e.name == *name && e.correct == *correct);
        if !unchanged {
            let at = prev.0.get(key).map_or(now, |e| now.max(e.at + 1));
            out.insert(
                key.clone(),
                Entry {
                    name: (*name).into(),
                    correct: (*correct).into(),
                    gone: false,
                    at,
                },
            );
        }
    }
    for (key, e) in &prev.0 {
        if !e.gone && !current.contains_key(key) {
            let mut dead = e.clone();
            dead.gone = true;
            dead.at = now.max(e.at + 1);
            out.insert(key.clone(), dead);
        }
    }
    SyncState(out)
}

/// The words that still exist, as the `PUT /v1/dictionary` body. Sorted by key.
pub fn to_body(state: &SyncState) -> DictionaryBody {
    let mut body = DictionaryBody {
        replacements: Vec::new(),
        vocabulary: Vec::new(),
    };
    for (key, e) in state.0.iter().filter(|(_, e)| !e.gone) {
        if key.starts_with("r:") {
            body.replacements.push(Replacement {
                wrong: e.name.clone(),
                correct: e.correct.clone(),
            });
        } else {
            body.vocabulary.push(e.name.clone());
        }
    }
    body
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dictionary::Dictionary;

    fn body(replacements: &[(&str, &str)], vocabulary: &[&str]) -> DictionaryBody {
        DictionaryBody {
            replacements: replacements
                .iter()
                .map(|(w, c)| Replacement {
                    wrong: (*w).into(),
                    correct: (*c).into(),
                })
                .collect(),
            vocabulary: vocabulary.iter().map(|t| (*t).into()).collect(),
        }
    }

    fn state(replacements: &[(&str, &str)], vocabulary: &[&str], now: u64) -> SyncState {
        record(&SyncState::default(), &body(replacements, vocabulary), now)
    }

    #[test]
    fn a_word_added_on_one_computer_shows_on_the_other() {
        let laptop = state(&[("btw", "by the way")], &[], 10);
        let desktop = state(&[], &["Gersi"], 20);
        let merged = to_body(&merge(&laptop, &desktop));
        assert_eq!(merged, body(&[("btw", "by the way")], &["Gersi"]));
    }

    #[test]
    fn a_deleted_word_stays_deleted_on_both_computers() {
        let before = state(&[("btw", "by the way")], &["Gersi"], 10);
        // The desktop deletes "btw" later. The laptop still holds the old copy.
        let desktop = record(&before, &body(&[], &["Gersi"]), 50);
        let on_laptop = merge(&before, &desktop);
        let on_desktop = merge(&desktop, &before);
        assert_eq!(to_body(&on_laptop), body(&[], &["Gersi"]));
        assert_eq!(on_laptop, on_desktop);
    }

    #[test]
    fn a_word_added_again_after_its_deletion_comes_back() {
        let gone = record(&state(&[], &["Gersi"], 10), &body(&[], &[]), 20);
        let back = record(&gone, &body(&[], &["Gersi"]), 30);
        assert_eq!(to_body(&merge(&gone, &back)), body(&[], &["Gersi"]));
    }

    #[test]
    fn two_offline_edits_of_different_words_both_survive() {
        let base = state(&[("btw", "by the way")], &[], 10);
        let laptop = record(
            &base,
            &body(&[("btw", "by the way"), ("imo", "in my opinion")], &[]),
            30,
        );
        let desktop = record(&base, &body(&[("btw", "by the way")], &["Gersi"]), 40);
        let merged = to_body(&merge(&laptop, &desktop));
        assert_eq!(
            merged,
            body(
                &[("btw", "by the way"), ("imo", "in my opinion")],
                &["Gersi"]
            )
        );
    }

    #[test]
    fn the_newest_edit_of_one_word_wins() {
        let base = state(&[("btw", "by the way")], &[], 10);
        let laptop = record(&base, &body(&[("btw", "by the way!")], &[]), 30);
        let desktop = record(&base, &body(&[("btw", "BTW")], &[]), 40);
        assert_eq!(
            to_body(&merge(&laptop, &desktop)),
            body(&[("btw", "BTW")], &[])
        );
    }

    #[test]
    fn built_in_words_never_enter_a_state() {
        let dictionary =
            Dictionary::with_builtins(vec![("zzq".into(), "mine".into())], vec!["Mytermz".into()]);
        let state = record(&SyncState::default(), &dictionary.body(), 10);
        let keys: Vec<&str> = state.0.keys().map(String::as_str).collect();
        assert_eq!(keys, ["r:zzq", "v:mytermz"]);
    }

    #[test]
    fn a_word_matches_without_regard_to_case() {
        let laptop = state(&[], &["Gersi"], 10);
        let desktop = state(&[], &["gersi"], 20);
        assert_eq!(to_body(&merge(&laptop, &desktop)).vocabulary, ["gersi"]);
    }

    #[test]
    fn an_unchanged_word_keeps_its_time_and_merge_is_stable() {
        let first = state(&[("btw", "by the way")], &["Gersi"], 10);
        let again = record(&first, &to_body(&first), 99);
        assert_eq!(again, first);
        assert_eq!(merge(&first, &first), first);
    }

    #[test]
    fn a_state_survives_a_round_trip_through_json() {
        let s = record(
            &state(&[("btw", "by the way")], &[], 10),
            &body(&[], &[]),
            20,
        );
        let text = serde_json::to_string(&s).unwrap();
        assert_eq!(serde_json::from_str::<SyncState>(&text).unwrap(), s);
    }

    #[test]
    fn a_device_name_cannot_leave_the_sync_folder() {
        assert_eq!(clean_device("JAKE-PC"), "JAKE-PC");
        assert_eq!(clean_device("..\\evil/name.json"), "evilnamejson");
        assert_eq!(clean_device(""), "this-computer");
    }
}

/// The file name stem for this computer: its name without anything but letters, digits,
/// `-` and `_`, so it can never point outside the sync folder.
pub fn device_name() -> String {
    let raw = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_default();
    clean_device(&raw)
}

fn clean_device(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if cleaned.is_empty() {
        "this-computer".into()
    } else {
        cleaned
    }
}
