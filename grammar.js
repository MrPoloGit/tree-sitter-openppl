// Tree-sitter grammar for OpenPPL, the poker bot-scripting language
// documented at https://documentation.help/OpenPPL/ (manual vendored
// locally at docs/openppl stuff/*.html; every fact this grammar encodes
// is cited back to the specific manual page it came from).
//
// SCOPE NOTE: this grammar needs ZERO entries from the OpenPPL symbol
// registry (openppl/registry/). Every symbol name, action name, and
// function name below is handled as a GENERIC identifier shape, never
// an enumerated list; see "Why the grammar never enumerates
// action/symbol names" below.
//
// Why the grammar never enumerates action/symbol names: a WHEN-rule's
// action position is always exactly
//   <identifier> (<expression>)? FORCE
// and FORCE is a reserved keyword that can never start a valid
// expression, so the grammar does not need to know which specific
// identifiers (BetMax, Call, RaiseTo, ...) are valid actions to parse
// this unambiguously: "the next token is FORCE" vs. "the next token
// starts an expression" is a purely syntactic question. The same is true
// for every other poker-symbol reference (StillToAct, HaveFlushDraw,
// balance0, ...): they are all just identifiers syntactically. Knowing
// WHICH identifiers are real, and what they mean, is the registry's job;
// this grammar only needs to know their *shape*.
//
// Confirmed, real uncertainties this grammar does NOT paper over:
//   - `board$AT SUITED` (space-separated keyword) vs. `board$ATSuited`
//     (suffix form) are BOTH accepted here, because the manual itself
//     gives both forms in different places and neither page corrects
//     the other.
//   - The "..." ellipsis seen in many of the manual's own example code
//     blocks (e.g. `WHEN hand$22 OR hand$33 OR hand$44...`) is treated
//     here as the manual's own documentation shorthand for "and so on",
//     NOT real OpenPPL syntax: no confirmed complete, runnable example
//     anywhere in the manual uses "..." as something other than
//     brevity. This grammar does not accept a bare "..." token. If that
//     turns out to be wrong (i.e. OpenHoldem's real parser does accept
//     it), that is a fact to confirm against the real engine, not to
//     guess into this grammar.
//   - The one-level-only nesting limit on open-ended WHEN-conditions
//     (Structure_Of_A_PPL_File.html, confirmed explicitly, including a
//     worked "this does not work" counter-example) is NOT enforced by
//     this grammar at all. The manual states indentation carries no
//     syntactic meaning, so nesting depth is an L1 semantic property of
//     a flat sequence of when_statements, not a grammar-level nesting
//     construct: syntax errors come from the grammar, rule errors come
//     from the registry and checker. Every when_statement here is a
//     flat sibling; a future checker walks the sequence to flag
//     more-than-one-level open-ended nesting.
//   - The "quantity-of" idiom (`50% PotSize`, `1/3 PotSize`, a
//     percentage or fraction immediately followed by an identifier,
//     with no operator between them, meaning "that fraction of the
//     identifier's value") is modeled narrowly as `relative_quantity`,
//     not as general expression-juxtaposition, because only two
//     examples confirm it exists at all and generalizing further would
//     be a guess, not a fact.

// Wrapped in token(prec(2, ...)) at every call site, not just returned as
// a bare RegExp: tree-sitter's lexer resolves competing tokens by LONGEST
// match first, and only breaks a tie-on-length by declared precedence.
// `identifier`'s regex (/[A-Za-z_$][A-Za-z0-9_$]*/) matches "FORCE" or
// "WHEN" in one token just as fully as any of these keyword regexes do,
// same length, so no amount of care in the regex itself resolves it,
// only an explicit higher lexical precedence does. Found by running
// `tree-sitter parse` against a real example and seeing FORCE show up as
// a plain identifier swallowed into the preceding action's argument,
// not by inspection.
function caseInsensitive(word) {
  return new RegExp(
    word
      .split("")
      .map((c) => (/[a-zA-Z]/.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c))
      .join("")
  );
}

module.exports = grammar({
  name: "openppl",

  extras: ($) => [/\s/, $.comment],

  word: ($) => $.identifier,

  conflicts: ($) => [],

  rules: {
    // Flat document root, same philosophy as tree-sitter-phh's "zero or
    // more arbitrary top-level items": real files always use section
    // headers (Structure_Of_A_PPL_File.html), but many of the manual's
    // own teaching examples show bare when_statements with no enclosing
    // section at all, so both are accepted. Deliberately FLAT, not a
    // `section` node owning nested children: grouping "which statements
    // belong to which section" is left to a document.cpp-style walk
    // over siblings (openppl-ls), the same way tree-sitter-phh keeps a
    // .phhs document flat and lets phh-ls own the hand-grouping. Not
    // because nesting is undesirable, but because a section that can be
    // followed immediately by another section's items with zero of its
    // own is a genuine LR ambiguity between "these items belong to the
    // preceding empty section" and "these are top-level items after
    // it": found by running `tree-sitter generate`, not by inspection.
    // The generator's own conflict report named the exact two
    // interpretations.
    document: ($) => repeat(choice($.section_header, $.when_statement, $.hand_range)),

    // "##f$preflop##", "##f$BigBlindChair##", "##list007##": ONE header
    // syntax for both OpenHoldem-function sections and handlists; which
    // kind it is is a naming CONVENTION (starts with "f$" vs. starts
    // with "list"), not a different grammar construct (confirmed:
    // Handlists.html states only the naming rule, reusing the same
    // "##...##" delimiter Structure_Of_A_PPL_File.html already defined
    // for functions).
    section_header: ($) => seq("##", field("name", $.identifier), "##"),

    comment: ($) => token(seq("//", /[^\r\n]*/)),

    // --- Statements --------------------------------------------------

    // "WHEN <condition> <action> FORCE" / "WHEN <condition> Set <var>" /
    // "WHEN <condition> RETURN <value> FORCE" / a bare
    // "WHEN <condition>" (an open-ended when; a flat sibling here, not
    // nested, see the file header above).
    when_statement: ($) =>
      seq(
        $.when_kw,
        field("condition", $._expression),
        optional(field("consequence", choice($.action_statement, $.set_statement, $.return_statement)))
      ),

    // "<identifier> (<expression>)? FORCE": deliberately not
    // enumerating action names; see the file header above.
    action_statement: ($) =>
      seq(field("action", $.identifier), optional(field("argument", $._expression)), $.force_kw),

    // "Set user_UTG_Was_Limping" / "Set me_st_MySecretVariable_3_141592653",
    // no FORCE (User_Defined_Variables.html, confirmed explicitly: "no
    // keyword force"). The variable's own naming convention (must start
    // with "user" or be a "me_st_"/"me_re_" memory symbol) is a registry/
    // checker-level fact, not enforced by the grammar.
    set_statement: ($) => seq($.set_kw, field("variable", $.identifier)),

    // "RETURN True FORCE" / "RETURN balance0 FORCE" / "RETURN (3 + Calls) FORCE"
    return_statement: ($) => seq($.return_kw, field("value", $._expression), $.force_kw),

    // Handlist body entries: "AA", "AKs", "72o", "AKo", confirmed
    // notation from Handlists.html's own example. Suited/offsuit suffix
    // letters here ("s"/"o") are the OPPOSITE convention from
    // hand$AKs's single-suit-letter meaning inside a hand-expression,
    // confirmed as a real, context-dependent double meaning, not
    // unified here because the manual itself does not unify it.
    hand_range: ($) => token(/[2-9TJQKA]{2}[sSoO]?/),

    // --- Expressions ---------------------------------------------------
    // Precedence (tightest to loosest), per Mathematical_Expressions.html
    // and differences to shanky.html (the "~~" operator is only on the
    // latter page, confirmed as a real omission from the former, not
    // this grammar's oversight):
    //   unary minus, hand/board expressions, parens, literals
    //   *  /  %  Mod            (arithmetic, tight)
    //   +  -                    (arithmetic, loose)
    //   =  !=  <  >  <=  >=  ~~  (comparison)
    //   Not                     (logical, tightest)
    //   And                     (logical)
    //   XOr                     (logical)
    //   Or                      (logical, loosest)
    _expression: ($) => $._logical_or,

    _logical_or: ($) => choice($.or_expression, $._logical_xor),
    or_expression: ($) => prec.left(1, seq($._logical_or, $.or_kw, $._logical_xor)),

    _logical_xor: ($) => choice($.xor_expression, $._logical_and),
    xor_expression: ($) => prec.left(2, seq($._logical_xor, $.xor_kw, $._logical_and)),

    _logical_and: ($) => choice($.and_expression, $._logical_not),
    and_expression: ($) => prec.left(3, seq($._logical_and, $.and_kw, $._logical_not)),

    _logical_not: ($) => choice($.not_expression, $._comparison),
    not_expression: ($) => prec(4, seq($.not_kw, $._comparison)),

    _comparison: ($) => choice($.comparison_expression, $._arithmetic_additive),
    comparison_expression: ($) =>
      prec.left(
        5,
        seq(
          $._arithmetic_additive,
          field(
            "operator",
            choice("=", "!=", "<=", ">=", "<", ">", "~~")
          ),
          $._arithmetic_additive
        )
      ),

    _arithmetic_additive: ($) => choice($.additive_expression, $._arithmetic_multiplicative),
    additive_expression: ($) =>
      prec.left(6, seq($._arithmetic_additive, field("operator", choice("+", "-")), $._arithmetic_multiplicative)),

    // Note: "%" is NOT one of these operators, even though
    // Mathematical_Expressions.html's operator table lists a
    // "Percentage-operator"; its own example for that row
    // ("AmountToCall <= 50% PotSize") is the exact same construct
    // `relative_quantity` below models; there is no separate confirmed
    // example of "%" used as a plain two-operand infix operator (e.g.
    // "50 % 3"), so modeling both would be redundant, conflicting grammar
    // paths for one real construct, not two.
    _arithmetic_multiplicative: ($) => choice($.multiplicative_expression, $._relative_quantity),
    multiplicative_expression: ($) =>
      prec.left(
        7,
        seq(
          $._arithmetic_multiplicative,
          field("operator", choice("*", "/", $.mod_kw)),
          $._relative_quantity
        )
      ),

    // "50% PotSize" / "1/3 PotSize": a percentage, or a fraction of two
    // literal numbers, immediately followed by an identifier with no
    // operator between them, meaning "that fraction of the identifier's
    // value". Deliberately narrow, see the file header's "quantity-of
    // idiom" note. The bare-fraction operands are restricted to
    // $.number specifically (not any expression) so this never competes
    // with multiplicative_expression's own general "/" between
    // arbitrary expressions (e.g. "Outs / CardsLeft" from the real
    // odds-and-outs example): "1/3" is two numeric literals, which
    // "Outs / CardsLeft" is not.
    _relative_quantity: ($) => choice($.relative_quantity, $._unary),
    relative_quantity: ($) =>
      prec(8, seq(choice($.percentage, $._bare_fraction), field("of", $.identifier))),
    _bare_fraction: ($) => prec(8, seq($.number, "/", $.number)),

    _unary: ($) => choice($.unary_expression, $._primary),
    unary_expression: ($) => prec(9, seq("-", $._primary)),

    _primary: ($) =>
      choice(
        $.parenthesized_expression,
        $.hand_expression,
        $.board_expression,
        $.percentage,
        $.number,
        $.identifier
      ),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    // "hand$AA", "hand$AQSuited", "hand$AcQd", "hand$AdT", "hand$AKs"
    // (the last one meaning two specific-suit cards, NOT "suited", see
    // the file header). Written as ONE token (not "hand$" + a separate
    // spec token): splitting it loses the lexer's longest-match contest
    // against `identifier` (which matches "hand$AA" fully, 7 characters,
    // in one token, same as a 5-character "hand$" sub-token followed by
    // a 2-character "AA" sub-token would, but as a competing WHOLE
    // against the first sub-token alone, that sub-token is shorter and
    // loses outright, found the same way as the keyword issue above,
    // by parsing a real example, not by inspection). The spec after
    // "hand$" is still recoverable from the token's own text (strip the
    // 5-character prefix) by whatever reads this node; its internal
    // rank/suit/suffix structure is a registry/hover concern, same as
    // tree-sitter-phh-actions is a separate concern from
    // tree-sitter-phh proper.
    hand_expression: ($) => token(prec(2, /[Hh][Aa][Nn][Dd]\$[A-Za-z0-9]+/)),

    // "board$A", "board$22", "board$AT", "board$ATSuited" (suffix form)
    // optionally followed by a separate "SUITED" keyword
    // ("board$AT SUITED", confirmed, see the file header's note on this
    // being an unresolved inconsistency between two manual pages; BOTH
    // forms are accepted here). The "board$..." part is one token for
    // the same reason hand_expression is; the optional trailing SUITED
    // keyword is a genuinely separate token after whitespace, so it
    // doesn't hit the same splitting problem.
    board_expression: ($) =>
      seq(token(prec(2, /[Bb][Oo][Aa][Rr][Dd]\$[A-Za-z0-9]+/)), optional(field("suited", $.suited_kw))),

    number: ($) => token(/[0-9]+(\.[0-9]+)?/),
    percentage: ($) => token(/[0-9]+(\.[0-9]+)?%/),

    // Generic identifier shape covering: OpenPPL library symbols
    // (StillToAct, HaveFlushDraw, ...), native OpenHoldem engine symbols
    // (balance0, pt_vpip0, ac_dealpos0, ...), OpenHoldem's double-dollar
    // symbols ($$pr0, $$ps1, Counting_Outs section of
    // OpenPPL_In_Practice.html), user-defined variables (user<Name>),
    // memory symbols (me_st_<Name>_<value>, me_re_<Name>), and
    // user-defined function references (f$<name>). Deliberately one
    // generic token, see the file header's "Why the grammar never
    // enumerates" note. Case is preserved verbatim; case-SENSITIVITY
    // enforcement (differences to shanky.html: "Cases Matter
    // (Partially)") is a registry/checker concern, not this token's.
    identifier: ($) => token(/[A-Za-z_$][A-Za-z0-9_$]*/),

    // --- Case-insensitive keywords --------------------------------------
    // differences to shanky.html, confirmed explicitly: keywords (WHEN,
    // FORCE, AND, OR, NOT, XOR, SET, RETURN, MOD, the "SUITED" keyword
    // form) accept "all upper-case, all lower-case, or a reasonable
    // mix", unlike action/symbol identifiers, which ARE case-sensitive
    // (enforced at the registry/checker level, not here).
    when_kw: ($) => token(prec(2, caseInsensitive("WHEN"))),
    force_kw: ($) => token(prec(2, caseInsensitive("FORCE"))),
    set_kw: ($) => token(prec(2, caseInsensitive("SET"))),
    return_kw: ($) => token(prec(2, caseInsensitive("RETURN"))),
    and_kw: ($) => token(prec(2, caseInsensitive("AND"))),
    or_kw: ($) => token(prec(2, caseInsensitive("OR"))),
    xor_kw: ($) => token(prec(2, caseInsensitive("XOR"))),
    not_kw: ($) => token(prec(2, caseInsensitive("NOT"))),
    mod_kw: ($) => token(prec(2, caseInsensitive("MOD"))),
    suited_kw: ($) => token(prec(2, caseInsensitive("SUITED"))),
  },
});
