/**
 * Flags literal colours in UI code so screens read colours only through the
 * tokens in src/theme. Catches inline styles, StyleSheet.create values,
 * variables and JSX props alike, because it inspects every string:
 *   - hex anywhere in a string: #fff, #ffff, #ffffff, #ffffffff
 *   - functional notation anywhere in a string: rgb( rgba( hsl( hsla(
 *   - any string literal (e.g. a named colour like 'red') given to a property
 *     or JSX attribute whose name ends in "color" (color, backgroundColor,
 *     borderColor, tintColor...), except 'transparent'.
 */
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i;
const FUNCTIONAL = /\b(?:rgba?|hsla?)\s*\(/i;
const COLOR_KEY = /colou?r$/i;
const ALLOWED_NAMED = new Set(['transparent']);

function keyName(node) {
  if (!node) return null;
  if (node.type === 'Identifier' || node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow literal colours outside src/theme; use the colour tokens.' },
    schema: [],
    messages: {
      literal: 'Literal colour {{value}}: use a token from src/theme (useColors()) instead.',
    },
  },
  create(context) {
    function check(node, text, parent) {
      if (HEX.test(text) || FUNCTIONAL.test(text)) {
        context.report({ node, messageId: 'literal', data: { value: JSON.stringify(text) } });
        return;
      }
      let key = null;
      if (parent && parent.type === 'Property' && parent.value === node) key = keyName(parent.key);
      if (parent && parent.type === 'JSXAttribute') key = keyName(parent.name);
      if (key && COLOR_KEY.test(key) && !ALLOWED_NAMED.has(text.trim().toLowerCase())) {
        context.report({ node, messageId: 'literal', data: { value: JSON.stringify(text) } });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value, node.parent);
      },
      TemplateLiteral(node) {
        const text = node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('${}');
        check(node, text, node.parent);
      },
    };
  },
};

module.exports = { rules: { 'no-literal-colors': rule } };
