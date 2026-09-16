/**
 * Club details in one place, so socials and copy can be corrected without
 * hunting through components.
 */

/**
 * A run of step text; `em` marks what a student has to find or match in ORS.
 * A newline is a line break, placed where the approved design breaks the line.
 */
export type OrsPart = string | { em: string };

export interface OrsStep {
  /** The text that starts beside the numbered circle painted on the plate. */
  parts: OrsPart[];
  /** Bulleted lines under it, for the male/female request types. */
  choices?: OrsPart[][];
}

export const CLUB = {
  name: 'AI & Data Science Club',
  short: 'AIDA',
  university: 'Ajman University',
  email: 'aiclubajman@gmail.com',
  socials: [
    { label: 'Instagram', handle: '@aic_au', url: 'https://instagram.com/aic_au' },
    { label: 'TikTok', handle: '@aic_au', url: 'https://tiktok.com/@aic_au' },
    {
      label: 'LinkedIn',
      handle: 'AIDA Club',
      url: 'https://www.linkedin.com/company/aida-club',
    },
  ],
  about: [
    'We are Ajman University students who build things with AI and data — projects, competitions, workshops and research.',
    'You do not need to be a programmer to join. Members come from every college, and most start by turning up to a session and seeing what interests them.',
  ],

  /**
   * The WhatsApp community invite behind the Join AIDA page's second button.
   *
   * Set this to null to take the button out of service: it then stays on the
   * page, inert and marked unavailable, rather than being a live link to
   * nowhere.
   */
  whatsappUrl: 'https://chat.whatsapp.com/FQ3AfxNQHkrGDstO8R0a06' as string | null,

  /**
   * Membership is handled entirely through the university's ORS system, not by
   * this site. Collecting names here would create a second list that is not
   * actually a membership list, which would be worse than sending people to
   * the real one.
   */
  ors: {
    url: 'https://ors.ajman.ac.ae/',
    steps: [
      { parts: ['Click the ', { em: 'OPEN ORS' }, ' button.'] },
      { parts: ['Go to ', { em: 'eRequests → New Request.' }] },
      { parts: ['Request Category: ', { em: 'Student Life.' }] },
      {
        parts: ['Request Type:'],
        choices: [
          ['If you are a male pick ', { em: '“Male student\nclub membership”' }],
          ['If you are a female pick ', { em: '“Female student\nclub membership”' }],
        ],
      },
      {
        parts: [
          'Select ',
          { em: '“Male/Female AI and Data\nScience Club”' },
          ' for the Student Clubs\n(Male/Female).',
        ],
      },
      { parts: ['Fill out the rest of the info.'] },
    ] satisfies OrsStep[],
  },
} as const;
