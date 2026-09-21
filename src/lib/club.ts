/**
 * Club details in one place, so socials and copy can be corrected without
 * hunting through components.
 */
export const CLUB = {
  name: 'AI & Data Science Club',
  short: 'AIDA',
  university: 'Ajman University',
  email: 'aiclubajman@gmail.com',
  whatsapp: 'https://chat.whatsapp.com/FQ3AfxNQHkrGDstO8R0a06',
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
   * Membership is handled entirely through the university's ORS system, not by
   * this site. Collecting names here would create a second list that is not
   * actually a membership list, which would be worse than sending people to
   * the real one.
   */
  ors: {
    url: 'https://ors.ajman.ac.ae/',
    steps: [
      'Log in to ORS at ors.ajman.ac.ae',
      'Go to New Request → Student Life',
      'Choose Female Student Club Membership or Male Student Club Membership',
      'Select AI and Data Science Club',
    ],
  },
} as const;
