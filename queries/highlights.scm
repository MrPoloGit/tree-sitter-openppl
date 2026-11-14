; Highlighting queries for OpenPPL, consumed by Neovim and Zed directly,
; and the ground truth any separately-maintained VS Code TextMate grammar
; should agree with (same discipline as tree-sitter-phh/queries/highlights.scm,
; tree-sitter-ohh/queries/highlights.scm).
;
; Deliberately has NO symbol-name-specific rules (no "StillToAct gets its
; own color" the way tree-sitter-phh text-matches `variant` or
; tree-sitter-ohh text-matches its four enum keys): a query can't read
; the registry those would need, so every identifier gets one generic
; @variable treatment here regardless.
;
; The keyword nodes below (when_kw, force_kw, etc.) are matched by RULE
; NAME, not by literal string text like `"WHEN"`, found necessary by
; testing, not assumed: these rules are case-insensitive regexes
; (grammar.js's `caseInsensitive` helper), not literal string tokens, so
; a query written as `["WHEN" "FORCE"] @keyword` silently matches nothing
; at all (confirmed: an earlier draft of this file did exactly that, and
; `tree-sitter query` returned zero captures for every keyword, caught by
; running it against the real corpus, not by reading the query back).

"##" @punctuation.special
(section_header name: (identifier) @label)

[
  (when_kw)
  (force_kw)
  (set_kw)
  (return_kw)
] @keyword

[
  (and_kw)
  (or_kw)
  (xor_kw)
  (not_kw)
  (mod_kw)
] @keyword.operator

(board_expression (suited_kw) @keyword)

[
  "="
  "!="
  "<="
  ">="
  "<"
  ">"
  "~~"
  "+"
  "-"
  "*"
  "/"
] @operator

"(" @punctuation.bracket
")" @punctuation.bracket

(comment) @comment
(number) @number
(percentage) @number
(hand_expression) @string.special
(board_expression) @string.special
(hand_range) @string.special.symbol

(action_statement action: (identifier) @function.builtin)
(identifier) @variable
