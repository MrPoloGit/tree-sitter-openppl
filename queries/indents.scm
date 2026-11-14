; Neovim's indent-query convention (@indent.begin/@indent.end), see
; tree-sitter-phh/queries/indents.scm's own note: Zed's convention
; (@indent/@end) is a separate file in that editor's own package, not
; interchangeable with this one.

(parenthesized_expression "(" @indent.begin ")" @indent.end)
