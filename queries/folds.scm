; Fold ranges for OpenPPL, fold each parenthesized expression's body.
; Sections aren't their own node (grammar.js's document root is
; deliberately flat, see that file's header for why), so there's no
; single node to fold "a whole section" by yet; that would need a
; document.cpp-style grouping pass in openppl-ls, same as tree-sitter-phh
; leans on phh-ls for .phhs hand-grouping rather than the grammar.

(parenthesized_expression) @fold
