import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import paths from 'routes/paths';
import { ticketsAPI } from 'services/api';
import PageHeader from 'components/sections/user-table/PageHeader';

const Tickets = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    loadTickets();
    loadMetrics();
  }, [filterStatus]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      const response = await ticketsAPI.getTickets(params);
      setTickets(response?.data || []);
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const data = await ticketsAPI.getMetrics();
      setMetrics(data.data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  };

  const handleViewTicket = async (ticketId: string) => {
    try {
      const response = await ticketsAPI.getTicket(ticketId);
      if (response?.data) {
        setSelectedTicket(response.data);
        setTicketDialogOpen(true);
      }
    } catch (err) {
      console.error('Failed to load ticket:', err);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !comment) return;

    try {
      await ticketsAPI.addComment(selectedTicket.id, comment, isInternal);
      setComment('');
      setIsInternal(false);
      setCommentDialogOpen(false);
      loadTickets();
      if (selectedTicket) {
        const response = await ticketsAPI.getTicket(selectedTicket.id);
        if (response?.data) {
          setSelectedTicket(response.data);
        }
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleResolveTicket = async () => {
    if (!selectedTicket) return;

    try {
      await ticketsAPI.resolveTicket(selectedTicket.id, 'Resolved by admin');
      setTicketDialogOpen(false);
      loadTickets();
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
    }
  };

  const handleAssignToSelf = async () => {
    if (!selectedTicket) return;

    try {
      await ticketsAPI.assignTicket(selectedTicket.id);
      loadTickets();
      if (selectedTicket) {
        const response = await ticketsAPI.getTicket(selectedTicket.id);
        if (response?.data) {
          setSelectedTicket(response.data);
        }
      }
    } catch (err) {
      console.error('Failed to assign ticket:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'error';
      case 'IN_PROGRESS':
        return 'warning';
      case 'RESOLVED':
        return 'success';
      case 'CLOSED':
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
    { field: 'ticketNumber', headerName: 'Ticket #', width: 150 },
    { field: 'subject', headerName: 'Subject', width: 250 },
    { field: 'category', headerName: 'Category', width: 120 },
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
    { field: 'customerEmail', headerName: 'Customer', width: 200 },
    { field: 'createdAt', headerName: 'Created', width: 180 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params) => (
        <Button size="small" variant="outlined" onClick={() => handleViewTicket(params.row.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="Support Tickets"
        breadcrumb={[
          { label: 'Home', url: paths.root },
          { label: 'Support', url: paths.tickets },
          { label: 'Tickets', active: true },
        ]}
      />
      {metrics && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={4}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Open Tickets
              </Typography>
              <Typography variant="h6">{metrics.overview?.openTickets || 0}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Avg Response Time
              </Typography>
              <Typography variant="h6">
                {metrics.performance?.avgResponseTimeHours
                  ? `${metrics.performance.avgResponseTimeHours.toFixed(1)}h`
                  : 'N/A'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Avg Resolution Time
              </Typography>
              <Typography variant="h6">
                {metrics.performance?.avgResolutionTimeHours
                  ? `${metrics.performance.avgResolutionTimeHours.toFixed(1)}h`
                  : 'N/A'}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <Tabs value={filterStatus} onChange={(e, v) => setFilterStatus(v)} sx={{ mb: 2 }}>
          <Tab value="all" label="All" />
          <Tab value="OPEN" label="Open" />
          <Tab value="IN_PROGRESS" label="In Progress" />
          <Tab value="RESOLVED" label="Resolved" />
        </Tabs>
        <DataGrid
          rows={tickets}
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
        open={ticketDialogOpen}
        onClose={() => setTicketDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{selectedTicket?.subject}</DialogTitle>
        <DialogContent>
          {selectedTicket && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Description
                </Typography>
                <Typography>{selectedTicket.description}</Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Chip label={selectedTicket.status} color={getStatusColor(selectedTicket.status)} />
                <Chip
                  label={selectedTicket.priority}
                  color={getPriorityColor(selectedTicket.priority)}
                />
                <Chip label={selectedTicket.category} />
              </Stack>
              {selectedTicket.comments && selectedTicket.comments.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Comments
                  </Typography>
                  {selectedTicket.comments.map((comment: any, idx: number) => (
                    <Paper key={idx} sx={{ p: 2, mb: 1 }}>
                      <Typography variant="body2">{comment.content}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(comment.createdAt).toLocaleString()}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(true)}>Add Comment</Button>
          <Button onClick={handleAssignToSelf} variant="outlined">
            Assign to Me
          </Button>
          <Button onClick={handleResolveTicket} variant="contained" color="success">
            Resolve
          </Button>
          <Button onClick={() => setTicketDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={commentDialogOpen}
        onClose={() => setCommentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <FormControlLabel
              control={
                <Checkbox checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
              }
              label="Internal (only visible to admins)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddComment} variant="contained" disabled={!comment}>
            Add Comment
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Tickets;
