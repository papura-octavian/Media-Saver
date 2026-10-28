import React, { useEffect, useRef } from 'react';
import { Button, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { IconCopy, IconTrash } from '@tabler/icons-react';
import surface from './SurfaceCard.module.css';
import styles from './LogsCard.module.css';

export type UiLogLine = { id: string; level: string; message: string };

export function LogsCard(props: {
  verbose: boolean;
  lines: UiLogLine[];
  onClear?: () => void;
  onCopyAll?: () => void;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new logs. Instant, since smooth scrolling restarts on every line and lags.
    if (!viewport.current) return;
    viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [props.lines]);

  return (
    <div className={`${surface.card} ${surface.hoverable}`} style={{ borderRadius: 20, padding: 18, height: 320 }}>
      <div className={styles.toolbar}>
        <div>
          <Text fw={700}>Logs</Text>
          <Text size="sm" c="dimmed">
            {props.verbose ? 'Verbose' : 'Important only'}
          </Text>
        </div>
        <Group gap={8}>
          <Button leftSection={<IconCopy size={16} />} variant="light" onClick={props.onCopyAll} disabled={!props.onCopyAll}>
            Copy
          </Button>
          <Button leftSection={<IconTrash size={16} />} variant="light" onClick={props.onClear} disabled={!props.onClear}>
            Clear
          </Button>
        </Group>
      </div>

      <div style={{ height: 14 }} />

      <ScrollArea h={250} viewportRef={viewport} offsetScrollbars>
        <Stack gap={6}>
          {props.lines.length === 0 ? (
            <Text size="sm" c="dimmed">
              No logs yet.
            </Text>
          ) : (
            props.lines.map((l) => (
              <div
                key={l.id}
                className={styles.logLine}
                style={{
                  color:
                    l.level === 'error'
                      ? 'rgba(255, 120, 120, 0.95)'
                      : l.level === 'warn'
                        ? 'rgba(255, 214, 102, 0.95)'
                        : l.level === 'info'
                          ? 'rgba(255,255,255,0.72)'
                          : 'rgba(255,255,255,0.55)'
                }}
              >
                {l.message}
              </div>
            ))
          )}
        </Stack>
      </ScrollArea>
    </div>
  );
}



