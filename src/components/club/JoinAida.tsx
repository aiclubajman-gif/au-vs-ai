import Image from 'next/image';
import Link from 'next/link';
import { CLUB } from '@/lib/club';
import styles from './JoinAida.module.css';

/**
 * Join AIDA.
 *
 * The plate is the finished artwork: branding, both mascots, the campus, the
 * JOIN AIDA hero, the two button shells with their icons and arrows, the ORS
 * panel frame with its clipboard icon and six numbered circles, and the footer
 * band with its dividers. The HTML supplies only words and link hit areas, in
 * artwork pixels (see the stylesheet), so it stays registered at any size.
 *
 * The ORS steps are the real ones a student has to follow. The field values
 * are emphasised because ORS will not accept anything but an exact match.
 */
export const JOIN_AIDA_PLATE_SRC = '/design/join-aida/plate.webp';

export function JoinAida() {
  const whatsappUrl = CLUB.whatsappUrl;

  return (
    <main className={styles.page}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={JOIN_AIDA_PLATE_SRC} alt="" aria-hidden="true" className={styles.backdrop} />
      <div className={styles.stage}>
        <Image
          src={JOIN_AIDA_PLATE_SRC}
          alt=""
          aria-hidden="true"
          width={853}
          height={1844}
          unoptimized
          loading="eager"
          fetchPriority="high"
          draggable={false}
          className={styles.plate}
        />

        <h1 className="sr-only">
          Join {CLUB.name} at {CLUB.university}
        </h1>

        {/* The plate paints both shells; these are the real controls over them. */}
        <a
          href={CLUB.ors.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.cta} ${styles.ors}`}
        >
          Open ORS
        </a>

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.cta} ${styles.whatsapp}`}
          >
            <span>
              Join WhatsApp
              <br />
              community
            </span>
          </a>
        ) : (
          <span
            className={`${styles.cta} ${styles.whatsapp} ${styles.unavailable}`}
            aria-disabled="true"
          >
            <span>
              Join WhatsApp
              <br />
              community
              {/* Inside the shell: there are only 17u between it and the panel. */}
              <span className={styles.unavailableNote}>Invite link coming soon</span>
            </span>
          </span>
        )}

        <h2 className={styles.panelTitle}>ORS registration process</h2>

        <ol className={styles.steps}>
          {CLUB.ors.steps.map((step, i) => (
            <li key={i} className={styles.step} data-n={i + 1}>
              {step.parts.map((part, j) =>
                typeof part === 'string' ? (
                  <span key={j}>{part}</span>
                ) : (
                  <strong key={j} className={styles.em}>
                    {part.em}
                  </strong>
                ),
              )}

              {'choices' in step && step.choices && (
                <ul className={styles.choices}>
                  {step.choices.map((choice) => (
                    <li key={choice.value} className={styles.choice}>
                      <strong className={styles.choiceValue}>{choice.value}</strong> {choice.who}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>

        <p className={styles.footerText}>
          Join the official {CLUB.name} community at {CLUB.university}.
        </p>
        <p className={styles.footerMotto}>
          Good data
          <br />
          Better decisions
          <br />
          Brighter tomorrows
        </p>

        <Link href="/" className={styles.back}>
          Back to Home
        </Link>
      </div>
    </main>
  );
}
