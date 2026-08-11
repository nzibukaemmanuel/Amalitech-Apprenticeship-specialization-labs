export interface DevResource {
  name: string;
  category: string;
  link: string;
  description: string;
}

export const resources: DevResource[] = [
  {
    name: 'MDN Web Docs',
    category: 'Documentation',
    link: 'https://developer.mozilla.org',
    description: 'Comprehensive reference for HTML, CSS, and JavaScript.',
  },
  {
    name: 'TypeScript Handbook',
    category: 'Documentation',
    link: 'https://www.typescriptlang.org/docs/handbook/intro.html',
    description: 'Official guide to TypeScript syntax and types.',
  },
  {
    name: 'Vite Guide',
    category: 'Documentation',
    link: 'https://vite.dev/guide/',
    description: 'Official documentation for the Vite build tool.',
  },
  {
    name: 'ESLint Rules',
    category: 'Documentation',
    link: 'https://eslint.org/docs/latest/rules/',
    description: 'Full list of configurable ESLint linting rules.',
  },
  {
    name: 'Prettier Options',
    category: 'Documentation',
    link: 'https://prettier.io/docs/en/options.html',
    description: 'Configuration options for the Prettier formatter.',
  },
  {
    name: 'Can I Use',
    category: 'Tools',
    link: 'https://caniuse.com',
    description: 'Browser support tables for web platform features.',
  },
  {
    name: 'DevDocs',
    category: 'Tools',
    link: 'https://devdocs.io',
    description: 'Fast, offline-capable API documentation browser.',
  },
  {
    name: 'Bundlephobia',
    category: 'Tools',
    link: 'https://bundlephobia.com',
    description: 'Check the cost of adding an npm package to your bundle.',
  },
  {
    name: 'RegExr',
    category: 'Tools',
    link: 'https://regexr.com',
    description: 'Learn, build, and test regular expressions.',
  },
  {
    name: 'Prettier Playground',
    category: 'Tools',
    link: 'https://prettier.io/playground/',
    description: 'Try Prettier formatting rules in the browser.',
  },
  {
    name: 'JavaScript.info',
    category: 'Learning',
    link: 'https://javascript.info',
    description: 'A modern, in-depth JavaScript tutorial.',
  },
  {
    name: 'Frontend Masters',
    category: 'Learning',
    link: 'https://frontendmasters.com',
    description: 'In-depth video courses on frontend engineering.',
  },
  {
    name: 'CSS-Tricks',
    category: 'Learning',
    link: 'https://css-tricks.com',
    description: 'Articles and guides on modern CSS techniques.',
  },
  {
    name: 'freeCodeCamp',
    category: 'Learning',
    link: 'https://www.freecodecamp.org',
    description: 'Free coding curriculum with certifications.',
  },
  {
    name: 'GitHub',
    category: 'Community',
    link: 'https://github.com',
    description: 'Host and collaborate on code repositories.',
  },
  {
    name: 'Stack Overflow',
    category: 'Community',
    link: 'https://stackoverflow.com',
    description: 'Q&A community for programming problems.',
  },
];
