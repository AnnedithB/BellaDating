import { useEffect, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import paths from 'routes/paths';
import { usersAPI } from 'services/api';
import PageHeader from 'components/sections/user-table/PageHeader';

const UserList = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, [pagination.page, pagination.limit, search, statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getUsers({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      if (!response) {
        setUsers([]);
        return;
      }
      setUsers(response.users || []);
      setPagination((prev) => ({
        ...prev,
        total: response.pagination?.total || 0,
      }));
    } catch (err: any) {
      console.error('Failed to load users:', err);
      // Don't show error if backend is not running - just show empty state
      if (err.message?.includes('connect')) {
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await usersAPI.updateUserStatus(userId, newStatus);
      loadUsers();
    } catch (err: any) {
      console.error('Failed to update user status:', err);
    }
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete({ id: user.id, email: user.email });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      await usersAPI.deleteUser(userToDelete.id);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      alert(err.message || 'Failed to delete user. Please try again.');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'SUSPENDED':
      case 'BANNED':
        return 'error';
      case 'INACTIVE':
        return 'default';
      default:
        return 'default';
    }
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'email', headerName: 'Email', width: 250 },
    { field: 'firstName', headerName: 'First Name', width: 150 },
    { field: 'lastName', headerName: 'Last Name', width: 150 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={getStatusColor(params.value)} size="small" />
      ),
    },
    { field: 'createdAt', headerName: 'Created', width: 180 },
    { field: 'lastActiveAt', headerName: 'Last Active', width: 180 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 280,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleStatusChange(params.row.id, 'ACTIVE')}
            disabled={params.row.status === 'ACTIVE'}
          >
            Activate
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => handleStatusChange(params.row.id, 'SUSPENDED')}
            disabled={params.row.status === 'SUSPENDED'}
          >
            Suspend
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => handleDeleteClick(params.row)}
          >
            Delete
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="User list"
        breadcrumb={[
          { label: 'Home', url: paths.root },
          { label: 'Users', active: true },
        ]}
        actionComponent={
          <Stack
            sx={{
              gap: 1,
            }}
          >
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BANNED">Banned</option>
            </select>
          </Stack>
        }
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{
            page: pagination.page - 1,
            pageSize: pagination.limit,
          }}
          onPaginationModelChange={(model) => {
            setPagination((prev) => ({
              ...prev,
              page: model.page + 1,
              limit: model.pageSize,
            }));
          }}
          rowCount={pagination.total}
          paginationMode="server"
        />
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete user <strong>{userToDelete?.email}</strong>? This action
            cannot be undone and will permanently remove the user from the database.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default UserList;
