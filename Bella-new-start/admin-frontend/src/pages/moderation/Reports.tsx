import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import paths from 'routes/paths';
import { moderationAPI } from 'services/api';
import PageHeader from 'components/sections/user-table/PageHeader';

const Reports = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await moderationAPI.getReports();
      setReports(data || []);
    } catch (err: any) {
      // Only show error if it's not a connection error
      if (!err.message?.includes('connect') && !err.message?.includes('Unable to connect')) {
        setError(err.message || 'Failed to load reports');
      } else {
        setError('Backend service is not running. Please start the Admin Service on port 3009.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTakeAction = async () => {
    if (!selectedReport || !action || !reason) return;

    try {
      await moderationAPI.takeAction(selectedReport.id, action, reason, severity);
      setActionDialogOpen(false);
      setSelectedReport(null);
      setAction('');
      setReason('');
      loadReports();
    } catch (err: any) {
      setError(err.message || 'Failed to take action');
    }
  };

  const handleAssignReport = async (reportId: string) => {
    try {
      await moderationAPI.assignReport(reportId);
      loadReports();
    } catch (err: any) {
      setError(err.message || 'Failed to assign report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'IN_REVIEW':
        return 'info';
      case 'RESOLVED':
        return 'success';
      case 'DISMISSED':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      default:
        return 'default';
    }
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'reportType', headerName: 'Type', width: 150 },
    { field: 'reporterUserId', headerName: 'Reporter', width: 150 },
    { field: 'reportedUserId', headerName: 'Reported User', width: 150 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={getStatusColor(params.value)} size="small" />
      ),
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={getPriorityColor(params.value)} size="small" />
      ),
    },
    { field: 'createdAt', headerName: 'Created', width: 180 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => handleAssignReport(params.row.id)}>
            Assign
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setSelectedReport(params.row);
              setActionDialogOpen(true);
            }}
          >
            Action
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="User Reports"
        breadcrumb={[
          { label: 'Home', url: paths.root },
          { label: 'Moderation', url: paths.moderation },
          { label: 'Reports', active: true },
        ]}
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <DataGrid
          rows={reports}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25 },
            },
          }}
        />
      </Paper>

      <Dialog
        open={actionDialogOpen}
        onClose={() => setActionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Take Action on Report</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Action</InputLabel>
              <Select value={action} onChange={(e) => setAction(e.target.value)} label="Action">
                <MenuItem value="BAN">Ban User</MenuItem>
                <MenuItem value="SUSPEND">Suspend User</MenuItem>
                <MenuItem value="WARN">Warn User</MenuItem>
                <MenuItem value="DELETE">Delete Content</MenuItem>
                <MenuItem value="APPROVE">Approve</MenuItem>
                <MenuItem value="REJECT">Reject</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                label="Severity"
              >
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleTakeAction} variant="contained" disabled={!action || !reason}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Reports;
