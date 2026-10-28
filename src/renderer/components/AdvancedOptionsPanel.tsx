import React from 'react';
import { Accordion, Checkbox, Divider, Group, NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import type { Settings } from '@shared/types';

export function AdvancedOptionsPanel(props: {
  settings: Settings;
  busy: boolean;
  onPatch: (patch: Partial<Settings>) => void | Promise<void>;
}) {
  const s = props.settings;
  return (
    <Accordion
      variant="filled"
      radius="lg"
      styles={{
        item: {
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)'
        },
        control: { paddingTop: 14, paddingBottom: 14 },
        panel: { paddingBottom: 14 }
      }}
      transitionDuration={200}
      chevron={<IconChevronDown size={16} />}
    >
      <Accordion.Item value="advanced">
        <Accordion.Control>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Title order={5} style={{ margin: 0 }}>
                Advanced
              </Title>
              <Text size="sm" c="dimmed">
                Client, cookies, user-agent, verbosity
              </Text>
            </div>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <div>
              <Text size="sm" fw={650}>
                Client
              </Text>
              <Text size="sm" c="dimmed">
                Choose a player client for YouTube extraction.
              </Text>
              <NativeSelect
                mt={8}
                value={s.youtubeClient}
                onChange={(e) => props.onPatch({ youtubeClient: e.currentTarget.value as Settings['youtubeClient'] })}
                data={[
                  { value: 'default', label: 'Automatic (recommended)' },
                  { value: 'web', label: 'web' },
                  { value: 'tv', label: 'tv' },
                  { value: 'ios', label: 'ios' },
                  { value: 'android', label: 'android' }
                ]}
                disabled={props.busy}
              />
            </div>

            <Divider opacity={0.35} />

            <div>
              <Text size="sm" fw={650}>
                Cookies
              </Text>
              <Text size="sm" c="dimmed">
                Use browser cookies to access age/geo restricted content (when allowed).
              </Text>
              <Checkbox
                mt={10}
                label="Use cookies from browser"
                checked={s.useCookiesFromBrowser}
                onChange={(e) => props.onPatch({ useCookiesFromBrowser: e.currentTarget.checked })}
                disabled={props.busy}
              />
              <NativeSelect
                mt={10}
                value={s.cookiesBrowser}
                onChange={(e) => props.onPatch({ cookiesBrowser: e.currentTarget.value as Settings['cookiesBrowser'] })}
                data={[
                  { value: 'chrome', label: 'chrome' },
                  { value: 'edge', label: 'edge' },
                  { value: 'firefox', label: 'firefox' },
                  { value: 'brave', label: 'brave' }
                ]}
                disabled={props.busy || !s.useCookiesFromBrowser}
              />
            </div>

            <Divider opacity={0.35} />

            <div>
              <Text size="sm" fw={650}>
                User-Agent
              </Text>
              <Text size="sm" c="dimmed">
                Optional override for tricky networks. Leave empty normally.
              </Text>
              <TextInput
                mt={10}
                placeholder="Mozilla/5.0 ..."
                value={s.userAgent}
                onChange={(e) => props.onPatch({ userAgent: e.currentTarget.value })}
                disabled={props.busy}
              />
            </div>

            <Divider opacity={0.35} />

            <div>
              <Text size="sm" fw={650}>
                Logs
              </Text>
              <Text size="sm" c="dimmed">
                Verbose shows extra diagnostics (useful for debugging).
              </Text>
              <Checkbox
                mt={10}
                label="Verbose logs"
                checked={s.verbose}
                onChange={(e) => props.onPatch({ verbose: e.currentTarget.checked })}
                disabled={props.busy}
              />
            </div>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}



