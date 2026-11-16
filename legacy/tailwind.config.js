/** @type {import('tailwindcss').Config} */
export default {
  content: ['./public/**/*.html'],
  // Clases que el JS arma dinámicamente (bg-${tono}soft / text-${tono})
  safelist: [{ pattern: /^(bg|text)-(good|warn|bad|accent)(soft)?$/ }],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface-2)', ink: 'var(--ink)', muted: 'var(--muted)', line: 'var(--line)',
        accent: 'var(--accent)', accentink: 'var(--accent-ink)', accentsoft: 'var(--accent-soft)', gold: 'var(--gold)', goldsoft: 'var(--gold-soft)',
        good: 'var(--good)', goodsoft: 'var(--good-soft)', warn: 'var(--warn)', warnsoft: 'var(--warn-soft)', bad: 'var(--bad)', badsoft: 'var(--bad-soft)',
      },
      fontFamily: { display: 'var(--f-display)', sans: 'var(--f-body)' },
    },
  },
};
