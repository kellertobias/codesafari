# A tiny temperature converter in Python.
#
# Python has two comment shapes rather than three: the regular hash line comment
# and the triple-quoted docstring, which stands in for both the "ranged" and
# "doc-block" comments of the C-family languages. The steps below use each.


"""
@tour temp:1 Celsius to Fahrenheit
The classic linear formula. Scale by 9/5, then shift by 32 so that water's
freezing point (0 C) lands on 32 F.

(Anchored with a triple-quoted docstring block — Python's doc-block form.)
"""
def to_fahrenheit(celsius):
    return celsius * 9 / 5 + 32


# @tour temp:2 The inverse
# Undo the conversion in the opposite order: subtract 32 first, then rescale.
# Getting the order wrong is the usual bug here.
#
# (Anchored with regular `#` line comments.)
def to_celsius(fahrenheit):
    return (fahrenheit - 32) * 5 / 9


"""
@tour comment Callouts are a `@tour comment` feature
A callout is a non-navigable note pinned to a spot in the file, produced by the
`@tour comment` header regardless of the surrounding comment style. In Python
the docstring (as here) is the preferred host; a `#` line run works too.

> [!NOTE] Also available in Markdown
> Any body can use Obsidian-style admonitions like this — `> [!NOTE] Title` —
> which the viewer renders as callout boxes.
"""


# @tour temp:3 A quick check
# A round trip should return the original value (barring float rounding), which
# makes for an easy sanity test of both directions at once.
if __name__ == "__main__":
    for c in (0, 37, 100):
        f = to_fahrenheit(c)
        print(f"{c} C = {f} F -> back to {to_celsius(f):.1f} C")
