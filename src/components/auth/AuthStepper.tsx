import styles from './AuthStepper.module.css';

/**
 * The four-stage sign-in progress shown above every auth screen.
 *
 * Sizes come from the `--u` custom property the parent screen sets (one
 * artwork pixel in CSS pixels), so the rings land exactly on the ones painted
 * into that screen's background plate.
 */
export type AuthStepKey = 'email' | 'otp' | 'profile' | 'ready';

const STEPS: { key: AuthStepKey; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'otp', label: 'OTP' },
  { key: 'profile', label: 'Profile' },
  { key: 'ready', label: 'Ready' },
];

export function AuthStepper({ current, className }: { current: AuthStepKey; className?: string }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol
      className={className ? `${styles.stepper} ${className}` : styles.stepper}
      aria-label={`Sign-in progress, step ${currentIndex + 1} of ${STEPS.length}`}
    >
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
        return (
          <li
            key={step.key}
            className={styles.step}
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.ring} aria-hidden="true">
              {i + 1}
            </span>
            <span className={styles.label}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
