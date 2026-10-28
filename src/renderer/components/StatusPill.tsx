import React from 'react';
import styles from './StatusPill.module.css';

import type { JobStatus } from '@shared/types';

export type UiStatus = JobStatus;

export function StatusPill(props: { status: UiStatus; rightLabel?: string | null }) {
  const mode: 'idle' | 'running' | 'done' | 'error' =
    props.status === 'error' ? 'error' : props.status === 'running' || props.status === 'cancelling' ? 'running' : props.status === 'finished' ? 'done' : 'idle';

  const label =
    props.status === 'cancelling'
      ? 'CANCELLING'
      : props.status === 'cancelled'
        ? 'CANCELLED'
        : props.status === 'running'
        ? 'RUNNING'
        : props.status === 'finished'
          ? 'DONE'
          : props.status === 'error'
            ? 'ERROR'
            : 'IDLE';

  return (
    <div className={`${styles.pill} ${styles[mode]}`}>
      <span className={styles.dot} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <span className={styles.label}>{label}</span>
        {props.rightLabel ? <span className={styles.sub}>{props.rightLabel}</span> : <span className={styles.sub}>Media Saver</span>}
      </div>
    </div>
  );
}



