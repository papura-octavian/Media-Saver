import React from 'react';
import { Button, Group, Progress, Stack, Text } from '@mantine/core';
import { IconCheck, IconCopy, IconExclamationCircle, IconFolderOpen } from '@tabler/icons-react';
import type { ProgressSnapshot } from '@shared/types';
import surface from './SurfaceCard.module.css';
import styles from './ProgressCard.module.css';
import type { UiStatus } from './StatusPill';

export function ProgressCard(props: {
  status: UiStatus;
  progress: ProgressSnapshot;
  pulse: boolean;
  destinationDir: string;
  doneMessage?: string | null;
  errorSummary?: string | null;
  onCopyErrorDetails?: () => void;
  onOpenFolder?: () => void;
}) {
  const percent = props.progress.percent ?? 0;
  const title = props.progress.title ?? '';
  const speed = props.progress.speed ?? '';
  const eta = props.progress.eta ?? '';

  const showDone = props.status === 'finished';
  const showError = props.status === 'error';
  const processing = props.status === 'running' && props.progress.stage === 'processing';

  return (
    <div
      className={`${surface.card} ${surface.hoverable} ${props.pulse ? surface.pulse : ''} ${showDone ? styles.ok : ''} ${showError ? styles.err : ''}`}
      style={{ borderRadius: 20, padding: 18 }}
    >
      <Stack gap={10}>
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={700}>Progress</Text>
            <Text size="sm" c="dimmed">
              {processing
                ? 'Converting…'
                : props.status === 'running'
                  ? 'Downloading…'
                  : props.status === 'cancelling'
                    ? 'Cancelling…'
                    : props.status === 'cancelled'
                      ? 'Cancelled'
                      : props.status === 'finished'
                        ? 'Saved'
                        : props.status === 'error'
                          ? 'Error'
                          : 'Ready'}
            </Text>
          </div>

          <Text size="sm" c="dimmed" fw={650}>
            {props.progress.percent != null ? `${percent.toFixed(1)}%` : '—'}
          </Text>
        </Group>

        <Progress value={percent} radius="xl" size="md" animated={processing} striped={processing} />

        <div className={styles.metaRow}>
          <div className={styles.titleLine} style={{ flex: 1, minWidth: 220 }}>
            {title ? `Title: ${title}` : 'Title: —'}
          </div>
          <div className={styles.stat}>
            {speed ? `Speed: ${speed}` : 'Speed: —'} • {eta ? `ETA: ${eta}` : 'ETA: —'}
          </div>
        </div>

        {showDone ? (
          <Group gap={10} mt={6} justify="space-between" wrap="nowrap">
            <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
              <IconCheck size={16} color="rgba(58,208,139,0.95)" style={{ flexShrink: 0 }} />
              <Text size="sm" c="dimmed" style={{ minWidth: 0 }}>
                {props.doneMessage ?? 'Saved.'} Folder:{' '}
                <span style={{ color: 'rgba(255,255,255,0.82)', wordBreak: 'break-all' }}>{props.destinationDir || 'destination folder'}</span>
              </Text>
            </Group>
            {props.onOpenFolder ? (
              <Button size="xs" variant="light" leftSection={<IconFolderOpen size={14} />} onClick={props.onOpenFolder} style={{ flexShrink: 0 }}>
                Open folder
              </Button>
            ) : null}
          </Group>
        ) : null}

        {showError ? (
          <Stack gap={8} mt={6}>
            <Group gap={10} align="flex-start">
              <IconExclamationCircle size={16} color="rgba(255,77,77,0.95)" style={{ marginTop: 2 }} />
              <div>
                <Text size="sm" fw={650}>
                  Something went wrong
                </Text>
                <Text size="sm" c="dimmed">
                  {props.errorSummary || 'Check logs for details.'}
                </Text>
              </div>
            </Group>
            <Button
              leftSection={<IconCopy size={16} />}
              variant="light"
              onClick={props.onCopyErrorDetails}
              disabled={!props.onCopyErrorDetails}
            >
              Copy error details
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </div>
  );
}



