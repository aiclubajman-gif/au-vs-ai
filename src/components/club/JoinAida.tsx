import { CLUB, type OrsPart } from '@/lib/club';
import { PlateScreen } from '@/components/ui/PlateScreen';
import styles from './JoinAida.module.css';

/**
 * Join AIDA.
 *
 * The plate is the finished artwork: the AIDA logo, both mascots and their
 * signs, the JOIN US headline, the two button shells with their icons and
 * arrows, and the ORS panel with its clipboard icon, heading rule, six numbered
 * circles and the line joining them. Everything a student reads or taps is
 * HTML over it, in artwork pixels (see the stylesheet), so it stays registered
 * at any size: both links, the panel heading and every step.
 *
 * The ORS steps are the real ones a student has to follow. What they have to
 * find or pick in ORS is emphasised, because the form will not accept anything
 * else.
 */
export const JOIN_AIDA_PLATE_SRC = '/design/join-aida/plate.webp';

export function JoinAida() {
  const whatsappUrl = CLUB.whatsappUrl;

  return (
    <PlateScreen
      plateSrc={JOIN_AIDA_PLATE_SRC}
      plateWidth={941}
      plateHeight={1672}
      className={styles.page}
    >
      {/* JOIN US is painted into the plate: announced here, not drawn twice. */}
      <h1 className="sr-only">Join us</h1>

      {/* What the right mascot says: decoration, so it is not read out. */}
      <p className={styles.bubble} aria-hidden="true">
        <span>Think</span>
        <span>Analyze</span>
        <span>Build</span>
      </p>

      {/* The plate paints both shells; these are the real links over them. */}
      <a
        href={CLUB.ors.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.cta} ${styles.ors}`}
      >
        <span className={styles.ctaLabel}>Open ORS</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>

      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.cta} ${styles.whatsapp}`}
        >
          <span className={styles.ctaLabel}>
            <span className={styles.ctaLine}>Join WhatsApp</span>{' '}
            <span className={styles.ctaLine}>community</span>
          </span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        // No invite link configured: the shell still reads, but nothing is clickable.
        <p className={`${styles.cta} ${styles.whatsapp} ${styles.unavailable}`}>
          <span className={styles.ctaLabel}>
            <span className={styles.ctaLine}>WhatsApp community</span>{' '}
            <span className={`${styles.ctaLine} ${styles.unavailableNote}`}>
              Invite link coming soon
            </span>
          </span>
        </p>
      )}

      <h2 className={styles.panelTitle}>ORS registration process</h2>

      {/* The painted circles carry the numbers, so the list never renders one.
          role="list": Safari drops list semantics once list-style is removed. */}
      <ol className={styles.steps} role="list">
        {CLUB.ors.steps.map((step, i) => (
          <li key={i} className={styles.step} data-n={i + 1}>
            <Parts parts={step.parts} />
            {'choices' in step && step.choices && (
              <ul className={styles.choices} role="list">
                {step.choices.map((choice, j) => (
                  <li key={j} className={styles.choice}>
                    <Parts parts={choice} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </PlateScreen>
  );
}

function Parts({ parts }: { parts: readonly OrsPart[] }) {
  return parts.map((part, i) =>
    typeof part === 'string' ? (
      <span key={i}>{part}</span>
    ) : (
      <strong key={i} className={styles.em}>
        {part.em}
      </strong>
    ),
  );
}
