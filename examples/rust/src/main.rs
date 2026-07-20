// A tiny word-frequency counter in Rust.
//
// Rust has the same three comment shapes as the C family: these regular `//`
// line comments, `/* ... */` ranged blocks, and `/** ... */` doc blocks. The
// steps and callout below are each labelled with the style they use.

use std::collections::HashMap;

/**
 * @tour wordcount:1 Counting words
 * Split on whitespace and tally each word into a map. `entry(...).or_insert(0)`
 * gives a mutable slot — inserting 0 the first time a word is seen, then
 * handing back the existing count on later hits.
 *
 * (Anchored with a doc-block comment — the doc-comment style.)
 */
fn word_counts(text: &str) -> HashMap<&str, u32> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    counts
}

/*
 * @tour wordcount:2 Printing the tally
 * A HashMap has no order, so we collect into a vec and sort by count descending
 * before printing — deterministic output the reader can rely on.
 *
 * (Anchored with a ranged block comment — the plain block style.)
 */
fn main() {
    let text = "the cat sat on the mat the cat purred";
    let counts = word_counts(text);

    let mut pairs: Vec<_> = counts.into_iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));

    for (word, count) in pairs {
        println!("{count:>2}  {word}");
    }
}

/**
 * @tour comment Why sort before printing?
 * The callout comes from the `@tour comment` header, not from the comment style
 * around it — this doc block is just the preferred way to write one. A HashMap
 * iterates in an unspecified order, so the sort is what makes the output
 * reproducible.
 */
