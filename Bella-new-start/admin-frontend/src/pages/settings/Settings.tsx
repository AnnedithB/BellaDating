import { useEffect, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import paths from 'routes/paths';
import { settingsAPI } from 'services/api';
import PageHeader from 'components/sections/user-table/PageHeader';

const Settings = () => {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsAPI.getSettings();
      if (!data) {
        setSettings([]);
        return;
      }
      setSettings(data);
      const initialEdited: Record<string, any> = {};
      data.forEach((setting: any) => {
        initialEdited[setting.key] = setting.value;
      });
      setEditedSettings(initialEdited);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSetting = async (key: string) => {
    try {
      setSaving(true);
      await settingsAPI.updateSetting(key, editedSettings[key]);
      setMessage({ type: 'success', text: 'Setting saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save setting' });
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (key: string, value: any) => {
    setEditedSettings({ ...editedSettings, [key]: value });
  };

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="System Settings"
        breadcrumb={[
          { label: 'Home', url: paths.root },
          { label: 'Settings', active: true },
        ]}
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
        {loading ? (
          <Typography>Loading settings...</Typography>
        ) : (
          <Stack spacing={3}>
            {settings.map((setting: any) => (
              <Box
                key={setting.key}
                sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
              >
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6">{setting.key}</Typography>
                    {setting.description && (
                      <Typography variant="body2" color="text.secondary">
                        {setting.description}
                      </Typography>
                    )}
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Value (JSON)"
                    value={JSON.stringify(editedSettings[setting.key] || setting.value, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        handleValueChange(setting.key, parsed);
                      } catch {
                        // Invalid JSON, keep as string
                        handleValueChange(setting.key, e.target.value);
                      }
                    }}
                    helperText="Enter valid JSON"
                  />
                  <Button
                    variant="contained"
                    onClick={() => handleSaveSetting(setting.key)}
                    disabled={saving}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Save
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
};

export default Settings;
