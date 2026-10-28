import React from 'react';
import {
  ActionIcon,
  Button,
  Group,
  NativeSelect,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core';
import { IconClipboard, IconFolder, IconPlayerPlay, IconSquare, IconUpload } from '@tabler/icons-react';
import type { Settings } from '@shared/types';
import styles from './ActionCard.module.css';
import surface from './SurfaceCard.module.css';
import { AdvancedOptionsPanel } from './AdvancedOptionsPanel';

export type Mode = 'single' | 'batch';

export function ActionCard(props: {
  settings: Settings;
  busy: boolean;
  url: string;
  mode: Mode;
  batchFile: { filePath: string; urls: string[] } | null;
  urlError?: string | null;
  destError?: string | null;
  onModeChange: (m: Mode) => void;
  onUrlChange: (v: string) => void;
  onPatchSettings: (patch: Partial<Settings>) => void | Promise<void>;
  onChooseDestination: () => void | Promise<void>;
  onPasteUrl: () => void | Promise<void>;
  onStartSingle: () => void | Promise<void>;
  onChooseTxt: () => void | Promise<void>;
  onStartBatch: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const s = props.settings;

  const canStartSingle = !props.busy && props.url.trim().length > 0 && !!s.destinationDir;
  const canStartBatch = !props.busy && !!props.batchFile && !!s.destinationDir;

  return (
    <div className={`${surface.card} ${surface.hoverable}`} style={{ borderRadius: 20, padding: 18 }}>
      <div className={styles.grid}>
        <div className={styles.topRow}>
          <div>
            <Text size="sm" fw={650}>
              Destination
            </Text>
            <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all', marginTop: 4 }}>
              {s.destinationDir || 'Choose a folder to save downloads'}
            </Text>
            {props.destError ? (
              <Text size="sm" c="red" mt={6}>
                {props.destError}
              </Text>
            ) : null}
          </div>
          <Button
            className={styles.press}
            leftSection={<IconFolder size={16} />}
            variant="light"
            onClick={props.onChooseDestination}
            disabled={props.busy}
          >
            Choose folder
          </Button>
        </div>

        <div>
          <Group justify="space-between" align="flex-end">
            <Text size="sm" fw={650}>
              Download mode
            </Text>
            <div className={styles.modeShell}>
              <SegmentedControl
                size="sm"
                radius="xl"
                value={props.mode}
                onChange={(v) => props.onModeChange(v as Mode)}
                data={[
                  { value: 'single', label: 'Single' },
                  { value: 'batch', label: 'Batch' }
                ]}
                styles={{
                  root: { background: 'transparent' },
                  indicator: {
                    background: 'rgba(76,125,255,0.18)',
                    border: '1px solid rgba(76,125,255,0.28)'
                  },
                  label: { fontWeight: 650 }
                }}
                disabled={props.busy}
              />
            </div>
          </Group>
          <Text size="sm" c="dimmed" mt={6}>
            {props.mode === 'single'
              ? 'Paste a video or playlist link.'
              : props.batchFile
                ? `Loaded: ${props.batchFile.urls.length} URLs`
                : 'Choose a TXT file (one URL per line).'}
          </Text>
        </div>

        {props.mode === 'single' ? (
          <TextInput
            label="YouTube URL"
            placeholder="https://www.youtube.com/watch?v=..."
            value={props.url}
            onChange={(e) => props.onUrlChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canStartSingle) void props.onStartSingle();
            }}
            disabled={props.busy}
            error={props.urlError ?? undefined}
            rightSection={
              <Tooltip label="Paste from clipboard" openDelay={450}>
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  onClick={props.onPasteUrl}
                  disabled={props.busy}
                  aria-label="Paste URL"
                >
                  <IconClipboard size={16} />
                </ActionIcon>
              </Tooltip>
            }
            rightSectionWidth={44}
            description={!props.url.trim() ? 'Paste a link to begin.' : undefined}
          />
        ) : (
          <Stack gap={10}>
            <Group justify="space-between" wrap="wrap">
              <Button
                className={styles.press}
                leftSection={<IconUpload size={16} />}
                variant="light"
                onClick={props.onChooseTxt}
                disabled={props.busy}
              >
                Choose TXT
              </Button>
              <Button
                className={`${styles.press} ${styles.btnPrimary}`}
                leftSection={<IconPlayerPlay size={16} />}
                onClick={props.onStartBatch}
                disabled={!canStartBatch}
              >
                Start batch
              </Button>
            </Group>
            {props.batchFile ? (
              <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>
                {props.batchFile.filePath}
              </Text>
            ) : null}
          </Stack>
        )}

        <Group grow>
          <NativeSelect
            label="Format"
            value={s.format}
            onChange={(e) => props.onPatchSettings({ format: e.currentTarget.value as Settings['format'] })}
            data={[
              { value: 'mp3', label: 'MP3 (audio)' },
              { value: 'mp4', label: 'MP4 (video)' }
            ]}
            disabled={props.busy}
          />
          {s.format === 'mp3' ? (
            <NativeSelect
              label="MP3 bitrate"
              value={String(s.mp3BitrateKbps)}
              onChange={(e) =>
                props.onPatchSettings({ mp3BitrateKbps: Number(e.currentTarget.value) as Settings['mp3BitrateKbps'] })
              }
              data={[
                { value: '128', label: '128 kbps' },
                { value: '192', label: '192 kbps (default)' },
                { value: '256', label: '256 kbps' },
                { value: '320', label: '320 kbps' }
              ]}
              disabled={props.busy}
            />
          ) : (
            <div />
          )}
        </Group>

        <AdvancedOptionsPanel settings={s} busy={props.busy} onPatch={props.onPatchSettings} />

        <div className={styles.ctaRow}>
          <Group gap={10}>
            <Button
              className={`${styles.press} ${styles.btnPrimary}`}
              leftSection={<IconPlayerPlay size={16} />}
              onClick={props.onStartSingle}
              disabled={!canStartSingle || props.mode !== 'single'}
            >
              Start (single)
            </Button>
            {props.mode === 'single' ? (
              <Button className={styles.press} leftSection={<IconUpload size={16} />} variant="light" onClick={props.onChooseTxt} disabled={props.busy}>
                Choose TXT
              </Button>
            ) : null}
          </Group>

          <Button
            className={styles.press}
            leftSection={<IconSquare size={16} />}
            color="red"
            variant="light"
            onClick={props.onCancel}
            disabled={!props.busy}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}



