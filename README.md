# tree-sitter-openppl

A tree-sitter grammar for OpenPPL, the first OpenPPL artifact built for this project.

## Scope: grammar only, no symbol registry

The project owner explicitly chose to start with the grammar and
deliberately **not** the ~312+ (likely 800-1000+ once parametric forms
are expanded) symbol registry, since that registry's raw source material
is extracted from the GPLv3-licensed OpenPPL manual, and licensing that
raised had to be resolved first (since resolved, see
`openppl-data/registry/README.md`). This grammar needed none of that: every OpenPPL
symbol, action name, and user-function name is handled as a **generic
identifier shape**, never an enumerated list, see `grammar.js`'s file
header, "Why the grammar never enumerates action/symbol names," for the
exact reasoning (short version: `FORCE` is a reserved keyword that can
never start a valid expression, so the grammar can tell "there's an
argument here" from "there isn't" without knowing a single action name).

## Build

```sh
tree-sitter generate
tree-sitter parse <file.ohf>
tree-sitter query queries/<name>.scm <file.ohf>
```

## What's implemented

- **Document structure**: `##f$preflop##`-style section headers (one
  syntax for both OpenHoldem functions and handlists, the only
  difference is a naming convention, not a grammar construct, confirmed
  from `Handlists.html`), kept **flat** at the document root rather than
  nesting statements inside a `section` node, found necessary by
  running `tree-sitter generate`, not assumed: nesting produced a real,
  unresolvable LR conflict (an empty section immediately followed by
  more items is genuinely ambiguous between "these belong to the
  preceding section" and "these are top-level"). Grouping statements by
  section is left to a future `openppl-ls`, the same way `phh-ls` (not
  `tree-sitter-phh`) owns `.phhs`'s hand-grouping.
- **The three statement forms**: `WHEN <condition> <action> FORCE`,
  `WHEN <condition> Set <variable>` (no `FORCE`, confirmed required-absent
  from `User_Defined_Variables.html`), `WHEN <condition> RETURN <value> FORCE`,
  and a bare `WHEN <condition>` (open-ended, un-nested at the grammar
  level per the file header's note).
- **Full operator precedence** per `Mathematical_Expressions.html` and
  `differences to shanky.html`: `Not > And > XOr > Or` (logical),
  comparisons (`= != < > <= >= ~~`), arithmetic (`+ - * / Mod`), the
  narrow `relative_quantity` idiom for `50% PotSize` / `1/3 PotSize`.
- **`hand$...` / `board$...` expressions**, including both confirmed
  forms of the suited-board inconsistency (`board$AT SUITED` and
  `board$ATSuited`, the manual gives both, uncorrected against each
  other; this grammar accepts both rather than guessing which is real).
- **Handlist bodies** (`AA`, `AKs`, `72o`) as a distinct `hand_range`
  token, confirmed to use the *opposite* `s`/`o` suffix convention from
  `hand$AKs`'s single-suit-letter meaning, both are kept, un-unified,
  because the manual itself doesn't unify them.
- **Case-insensitive keywords** (`WHEN`, `FORCE`, `AND`, `OR`, `NOT`,
  `XOR`, `SET`, `RETURN`, `MOD`, `SUITED`) vs. **case-preserved
  identifiers** (symbol/action names), `differences to shanky.html`'s
  explicit three-way case-sensitivity split (grammar.js's file header
  has the full table). Case-SENSITIVITY *enforcement* for identifiers is
  a registry/checker concern, not this grammar's; the grammar only
  avoids *destroying* the original case.
- Query files: `highlights.scm`, `folds.scm`, `indents.scm` (Neovim's
  `@indent.begin`/`@indent.end` convention), `outline.scm` (Zed's
  `@item`/`@name` convention, not independently validated against a live
  Zed install, same standing caveat `tree-sitter-phh`'s own outline.scm
  carries).

## How this was verified, three real bugs found, not assumed away

`openppl-data/corpus/valid/*.ohf` and `openppl-data/corpus/invalid/*.ohf` are built
directly from the manual's own complete, non-abbreviated examples (not
the many examples that use a bare `"..."` for brevity, see the "..."
note below). Every corpus file parses with **zero `ERROR` nodes**
(confirmed via `tree-sitter parse`); every query file produces the
expected captures with **zero error-like output** (confirmed via
`tree-sitter query`), checked against the whole corpus, not a single
hand-picked file.

Three real, concrete bugs were caught this way, not by reading the
grammar back:

1. **`FORCE` (and every other keyword) was being swallowed as a bogus
   identifier.** `caseInsensitive()`'s regex and the generic `identifier`
   token both match text like `FORCE` with the exact same length, and
   tree-sitter's lexer resolves equal-length competing tokens by
   declared precedence, not by which rule "looks like" a keyword. Fixed
   by wrapping every keyword token in `token(prec(2, ...))`, giving it
   explicit priority over `identifier`'s implicit precedence of 0.
2. **`hand$AA` parsed as a plain `identifier`, not `hand_expression`.**
   Splitting it into two separate tokens (`hand$` then the spec) made
   the *first* sub-token shorter than `identifier`'s single match over
   the whole text, so maximal-munch picked `identifier` outright before
   precedence ever got a chance to matter. Fixed by making
   `hand_expression`/`board_expression` single tokens matching the whole
   `hand$...`/`board$...` run, with explicit precedence over `identifier`.
3. **The keyword highlight queries matched literal strings
   (`["WHEN" "FORCE"] @keyword`) against rules that are case-insensitive
   *regexes*, not literal string tokens**, these never match anything
   in a tree-sitter query, since a query's literal-string syntax only
   matches an anonymous token whose grammar definition is that exact
   string. The keyword rules were also originally hidden (`_`-prefixed),
   so they produced no node for a query to reference by name either.
   Fixed by making every keyword rule a visible named rule and querying
   it by rule name (`(when_kw) @keyword`), confirmed via `tree-sitter
   query` actually returning captures afterward.

## Confirmed-uncertain, not silently resolved

- **`board$AT SUITED` vs. `board$ATSuited`**: both accepted; which is
  the engine's real, intended syntax is unconfirmed.
- **The `"..."` ellipsis** seen throughout the manual's own example code
  (e.g. `WHEN hand$22 OR hand$33 OR hand$44...`) is treated as
  documentation shorthand for "and so on," not real syntax, and is **not
  accepted** by this grammar. No example anywhere in the manual uses
  `"..."` in a way that reads as a complete, runnable program rather
  than an abbreviated teaching snippet.
- **`WHEN NOT In BigBlind AND ...`** (`OpenPPL_In_Practice.html`'s
  "Folding Trash" example) does **not** parse, confirmed directly by
  running it through this grammar and getting a real `ERROR` node (not
  assumed). The symbol is almost certainly meant to be the one-word
  `InBigBlind` (matching `Position_Symbols.html`'s own naming convention,
  e.g. `InButton`), making this the manual's third found internal
  inconsistency (alongside the `board$...` one above and a likely-missing
  `Set` keyword elsewhere), recorded as found, not silently "corrected"
  into the grammar.
- **One-level-only open-ended-`WHEN` nesting** is a real, explicitly
  stated rule (`Structure_Of_A_PPL_File.html`) that this grammar does
  **not** enforce, see `grammar.js`'s file header for why that's a
  deliberate choice (the manual itself says indentation carries no
  syntactic meaning, so nesting depth is a property of a flat sequence,
  not a parseable nesting construct) and whose job enforcing it is
  (a future `openppl-ls`, not this grammar).
