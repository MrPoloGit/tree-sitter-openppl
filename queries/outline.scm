; An editor outline view's per-section listing, matches Zed's documented
; @item/@name convention (same as tree-sitter-phh/queries/outline.scm;
; NOT validated against a live Zed install in this session, same caveat
; that file already carries).
(section_header name: (identifier) @name) @item
